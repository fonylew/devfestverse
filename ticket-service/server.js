import http from 'node:http';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';

// ============================================================================
// 1. CONFIGURATION & SECURITY CONSTANTS
// ============================================================================
const MAX_BODY_BYTES = 4096; // 4 KB strict payload ceiling
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute sliding window
const MAX_REQ_PER_IP_PER_MIN = 12;
const MAX_REQ_PER_SUB_PER_MIN = 8;
const MAX_RATE_LIMIT_KEYS = 10_000; // Bounded memory cap against IP spoofing OOM
const JWT_REGEX = /^Bearer ([A-Za-z0-9_-]{10,1024}\.[A-Za-z0-9_-]{10,2048}\.[A-Za-z0-9_-]{10,1024})$/;
const TICKET_ID_REGEX = /^DFBKK26-[A-F0-9]{8}$/;

/**
 * Derive a deterministic 8-hex-character ticket ID from Google `sub` and the HMAC secret.
 * This guarantees the exact same `ticket_id` and QR code every time for a given Google account.
 */
export function deriveDeterministicTicketId(sub, hmacSecret) {
  const hash = crypto
    .createHmac('sha256', hmacSecret)
    .update(`TICKET_ID_V1:${sub}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `DFBKK26-${hash}`;
}

/**
 * Sign a canonical ticket payload: `DFBKK26:<ticket_id>:<email>:<hmac_sha256_hex>`
 */
export function signTicketPayload(ticketId, email, hmacSecret) {
  const cleanEmail = String(email).trim().toLowerCase();
  const data = `DFBKK26:${ticketId}:${cleanEmail}`;
  const sig = crypto
    .createHmac('sha256', hmacSecret)
    .update(data)
    .digest('hex');
  return `${data}:${sig}`;
}

/**
 * Verify a scanned QR payload in constant time (`crypto.timingSafeEqual`).
 * Returns `{ valid: true, ticketId, email }` or `{ valid: false, reason }`.
 */
export function verifyTicketPayload(qrString, hmacSecret) {
  if (typeof qrString !== 'string' || qrString.length < 25 || qrString.length > 320) {
    return { valid: false, reason: 'Malformed QR length' };
  }
  const parts = qrString.trim().split(':');
  if (parts.length !== 4) {
    return { valid: false, reason: 'Invalid QR segment count' };
  }
  const [prefix, ticketId, email, providedSigHex] = parts;
  if (prefix !== 'DFBKK26' || !TICKET_ID_REGEX.test(ticketId)) {
    return { valid: false, reason: 'Invalid ticket prefix or ID format' };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || cleanEmail.length > 200 || !/^[a-f0-9]{64}$/i.test(providedSigHex)) {
    return { valid: false, reason: 'Invalid email or signature format' };
  }

  const expectedSigHex = crypto
    .createHmac('sha256', hmacSecret)
    .update(`DFBKK26:${ticketId}:${cleanEmail}`)
    .digest('hex');

  const bufA = Buffer.from(providedSigHex.toLowerCase(), 'hex');
  const bufB = Buffer.from(expectedSigHex.toLowerCase(), 'hex');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'Cryptographic signature mismatch' };
  }

  return { valid: true, ticketId, email: cleanEmail };
}

/**
 * Sanitize user display name to prevent Stored/DOM XSS or control-char injection.
 */
export function sanitizeDisplayName(rawName, fallbackEmail = '') {
  const base = typeof rawName === 'string' && rawName.trim()
    ? rawName
    : String(fallbackEmail).split('@')[0] || 'Attendee';
  return base
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .slice(0, 80) || 'Attendee';
}

/**
 *Bounded Sliding-Window Rate Limiter
 */
export class BoundedRateLimiter {
  constructor(maxKeys = MAX_RATE_LIMIT_KEYS) {
    this.maxKeys = maxKeys;
    this.buckets = new Map();
  }

  allow(key, maxRequests, windowMs = RATE_LIMIT_WINDOW_MS, now = Date.now()) {
    let entry = this.buckets.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      if (!entry && this.buckets.size >= this.maxKeys) {
        // Evict oldest key to guarantee bounded memory
        const oldestKey = this.buckets.keys().next().value;
        if (oldestKey !== undefined) this.buckets.delete(oldestKey);
      }
      entry = { windowStart: now, count: 1 };
      this.buckets.set(key, entry);
      return true;
    }
    if (entry.count >= maxRequests) {
      return false;
    }
    entry.count += 1;
    return true;
  }
}

/**
 * Extract real client IP appended by Google Cloud Run's Google Frontend (GFE).
 * Taking `.at(-1)` prevents attackers from spoofing `X-Forwarded-For: 1.2.3.4`.
 */
export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const ips = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) return ips.at(-1);
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ============================================================================
// 2. APPLICATION FACTORY (Dependency-Injectable for Unit & Red-Team Testing)
// ============================================================================
export function createTicketServer(options = {}) {
  const {
    googleClientId = process.env.GOOGLE_CLIENT_ID || '',
    hmacSecret = process.env.TICKET_HMAC_SECRET || '',
    recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY || '',
    allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://gdgcloudbkk.space')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    staffEmails = new Set(
      (process.env.STAFF_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
    collectionName = process.env.FIRESTORE_COLLECTION || 'devfest2026_tickets',
    verifyGoogleTokenFn = null,
    verifyRecaptchaFn = null,
    store = null,
  } = options;

  if (!hmacSecret || hmacSecret.length < 32) {
    throw new Error('TICKET_HMAC_SECRET must be set and at least 32 characters long.');
  }

  const oauthClient = new OAuth2Client(googleClientId);
  const ipLimiter = new BoundedRateLimiter();
  const subLimiter = new BoundedRateLimiter();

  // Default Google ID token verifier (RS256 via Google JWKS)
  const verifyGoogleToken =
    verifyGoogleTokenFn ||
    (async (idToken) => {
      if (!googleClientId) {
        throw new Error('GOOGLE_CLIENT_ID is not configured');
      }
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Unverified or incomplete Google account payload');
      }
      return {
        sub: String(payload.sub),
        email: String(payload.email).trim().toLowerCase(),
        name: sanitizeDisplayName(payload.name, payload.email),
      };
    });

  // Default Google reCAPTCHA v3 verifier
  const verifyRecaptcha =
    verifyRecaptchaFn ||
    (async (token, expectedAction, remoteIp) => {
      if (!recaptchaSecretKey) {
        throw new Error('RECAPTCHA_SECRET_KEY is not configured');
      }
      if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
        return { success: false, reason: 'Invalid reCAPTCHA token' };
      }
      const params = new URLSearchParams({
        secret: recaptchaSecretKey,
        response: token,
      });
      if (remoteIp && remoteIp !== 'unknown') {
        params.set('remoteip', remoteIp);
      }
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!resp.ok) {
        return { success: false, reason: 'reCAPTCHA verification request failed' };
      }
      const data = await resp.json();
      if (!data.success) {
        return { success: false, reason: 'reCAPTCHA token rejected' };
      }
      if (data.action && data.action !== expectedAction) {
        return { success: false, reason: 'reCAPTCHA action mismatch' };
      }
      if (typeof data.score === 'number' && data.score < 0.5) {
        return { success: false, reason: 'reCAPTCHA bot score too low' };
      }
      const allowedHostnames = allowedOrigins.map((o) => {
        try {
          return new URL(o).hostname;
        } catch {
          return o;
        }
      });
      if (data.hostname && !allowedHostnames.includes(data.hostname)) {
        return { success: false, reason: 'reCAPTCHA hostname mismatch' };
      }
      return { success: true, score: data.score ?? 1.0 };
    });

  // Default Firestore ACID transactional backing store
  let backingStore = store;
  if (!backingStore) {
    const db = new Firestore();
    const col = db.collection(collectionName);
    backingStore = {
      async getTicketBySub(sub) {
        const snap = await col.doc(sub).get();
        return snap.exists ? snap.data() : null;
      },
      async getOrCreateTicket(sub, { name, email, ticketId }) {
        const docRef = col.doc(sub);
        return db.runTransaction(async (tx) => {
          const snap = await tx.get(docRef);
          if (snap.exists) {
            return { record: snap.data(), created: false };
          }
          const nowIso = new Date().toISOString();
          const record = {
            name,
            email,
            ticket_id: ticketId,
            checked_in: false,
            created_at: nowIso,
          };
          tx.set(docRef, record);
          return { record, created: true };
        });
      },
      async checkInTicket(ticketId, email, staffEmail) {
        return db.runTransaction(async (tx) => {
          const querySnap = await tx.get(
            col.where('ticket_id', '==', ticketId).limit(1)
          );
          if (querySnap.empty) {
            return { status: 'NOT_FOUND' };
          }
          const docSnap = querySnap.docs[0];
          const data = docSnap.data();
          if (String(data.email).toLowerCase() !== email.toLowerCase()) {
            return { status: 'NOT_FOUND' };
          }
          if (data.checked_in === true) {
            return {
              status: 'ALREADY_USED',
              ticket_id: data.ticket_id,
              name: data.name,
              email: data.email,
              checked_in_at: data.checked_in_at,
              checked_in_by: data.checked_in_by,
            };
          }
          const checkedInAt = new Date().toISOString();
          tx.update(docSnap.ref, {
            checked_in: true,
            checked_in_at: checkedInAt,
            checked_in_by: staffEmail,
          });
          return {
            status: 'VALID',
            ticket_id: data.ticket_id,
            name: data.name,
            email: data.email,
            checked_in_at: checkedInAt,
          };
        });
      },
    };
  }

  function sendJson(res, statusCode, payload, originHeader) {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store',
    };
    if (originHeader && allowedOrigins.includes(originHeader)) {
      headers['Access-Control-Allow-Origin'] = originHeader;
      headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
      headers['Vary'] = 'Origin';
    }
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(payload));
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let totalBytes = 0;
      const chunks = [];
      req.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BODY_BYTES) {
          req.destroy();
          reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (totalBytes === 0) {
          resolve({});
          return;
        }
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            reject(Object.assign(new Error('Invalid JSON object'), { statusCode: 400 }));
            return;
          }
          resolve(parsed);
        } catch {
          reject(Object.assign(new Error('Malformed JSON'), { statusCode: 400 }));
        }
      });
      req.on('error', (err) => reject(err));
    });
  }

  const server = http.createServer(async (req, res) => {
    const origin = req.headers['origin'] || '';
    const urlPath = (req.url || '/').split('?')[0];

    // 1. Healthcheck endpoint
    if (req.method === 'GET' && urlPath === '/healthz') {
      return sendJson(res, 200, { ok: true }, origin);
    }

    // 2. Strict Origin validation for browser requests
    if (!origin || !allowedOrigins.includes(origin)) {
      return sendJson(res, 403, { error: 'Forbidden origin' }, '');
    }

    // 3. CORS Preflight
    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, {}, origin);
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' }, origin);
    }

    // 4. Early Content-Length Gate before reading stream
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return sendJson(res, 413, { error: 'Payload too large' }, origin);
    }

    // 5. Real-IP Rate Limiting (GFE last hop)
    const clientIp = getClientIp(req);
    if (!ipLimiter.allow(clientIp, MAX_REQ_PER_IP_PER_MIN)) {
      return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, origin);
    }

    // 6. Pre-Crypto JWT Format Gate
    const authHeader = String(req.headers['authorization'] || '');
    const jwtMatch = JWT_REGEX.exec(authHeader);
    if (!jwtMatch) {
      return sendJson(res, 401, { error: 'Missing or malformed Bearer token' }, origin);
    }
    const idToken = jwtMatch[1];

    // 7. Read bounded JSON body
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      const code = err.statusCode || 400;
      return sendJson(res, code, { error: err.message || 'Bad request' }, origin);
    }

    // 8. Cryptographically Verify Google RS256 ID Token
    let user;
    try {
      user = await verifyGoogleToken(idToken);
    } catch {
      return sendJson(res, 401, { error: 'Invalid or expired Google ID token' }, origin);
    }

    // 9. Per-User Rate Limiting
    if (!subLimiter.allow(user.sub, MAX_REQ_PER_SUB_PER_MIN)) {
      return sendJson(res, 429, { error: 'Too many requests for this account' }, origin);
    }

    // ========================================================================
    // ROUTE A: POST /ticket — Register or Retrieve Deterministic Signed QR
    // ========================================================================
    if (urlPath === '/ticket') {
      try {
        // Check if participant already registered so returning users can view QR smoothly
        let existing = await backingStore.getTicketBySub(user.sub);
        if (!existing) {
          // Require human reCAPTCHA v3 verification for new registrations
          const recaptchaCheck = await verifyRecaptcha(
            body.recaptchaToken,
            'register_ticket',
            clientIp
          );
          if (!recaptchaCheck.success) {
            return sendJson(
              res,
              403,
              { error: recaptchaCheck.reason || 'reCAPTCHA verification failed' },
              origin
            );
          }

          const deterministicId = deriveDeterministicTicketId(user.sub, hmacSecret);
          const txResult = await backingStore.getOrCreateTicket(user.sub, {
            name: user.name,
            email: user.email,
            ticketId: deterministicId,
          });
          existing = txResult.record;
        }

        const qrPayload = signTicketPayload(existing.ticket_id, existing.email, hmacSecret);
        return sendJson(
          res,
          200,
          {
            ticket_id: existing.ticket_id,
            name: existing.name,
            email: existing.email,
            checked_in: Boolean(existing.checked_in),
            qr_payload: qrPayload,
          },
          origin
        );
      } catch {
        return sendJson(res, 500, { error: 'Internal server error' }, origin);
      }
    }

    // ========================================================================
    // ROUTE B: POST /checkin — Staff QR Scanner Verification & Atomic Check-in
    // ========================================================================
    if (urlPath === '/checkin') {
      if (!staffEmails.has(user.email)) {
        return sendJson(
          res,
          403,
          { error: 'Unauthorized: Your email is not on the GDG organizer staff allowlist' },
          origin
        );
      }

      const qrCheck = verifyTicketPayload(body.qr, hmacSecret);
      if (!qrCheck.valid) {
        return sendJson(
          res,
          400,
          { status: 'INVALID_QR', error: qrCheck.reason },
          origin
        );
      }

      try {
        const result = await backingStore.checkInTicket(
          qrCheck.ticketId,
          qrCheck.email,
          user.email
        );
        if (result.status === 'NOT_FOUND') {
          return sendJson(
            res,
            404,
            { status: 'NOT_FOUND', error: 'Ticket record not found in database' },
            origin
          );
        }
        return sendJson(res, 200, result, origin);
      } catch {
        return sendJson(res, 500, { error: 'Internal server error' }, origin);
      }
    }

    return sendJson(res, 404, { error: 'Not found' }, origin);
  });

  return server;
}

// Start server if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8080);
  const srv = createTicketServer();
  srv.listen(port, '0.0.0.0', () => {
    console.log(`DevFest Bangkok 2026 Ticket Service listening on port ${port}`);
  });
}
