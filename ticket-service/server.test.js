import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketServer,
  deriveDeterministicTicketId,
  signTicketPayload,
  verifyTicketPayload,
  sanitizeDisplayName,
  getClientIp,
} from './server.js';

const TEST_HMAC_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ORIGIN = 'https://gdgcloudbkk.space';
const VALID_DUMMY_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlMTIzNDU2';
const STAFF_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI5OTk5OTk5OTk5In0.c3RhZmZfc2lnbmF0dXJl';

function createInMemoryStore() {
  const docsBySub = new Map();
  return {
    docsBySub,
    async getTicketBySub(sub) {
      return docsBySub.get(sub) || null;
    },
    async getOrCreateTicket(sub, { name, email, ticketId }) {
      if (docsBySub.has(sub)) {
        return { record: docsBySub.get(sub), created: false };
      }
      const record = {
        name,
        email,
        ticket_id: ticketId,
        checked_in: false,
        created_at: new Date().toISOString(),
      };
      docsBySub.set(sub, record);
      return { record, created: true };
    },
    async checkInTicket(ticketId, email, staffEmail) {
      for (const [, doc] of docsBySub.entries()) {
        if (doc.ticket_id === ticketId && doc.email.toLowerCase() === email.toLowerCase()) {
          if (doc.checked_in) {
            return {
              status: 'ALREADY_USED',
              ticket_id: doc.ticket_id,
              name: doc.name,
              email: doc.email,
              checked_in_at: doc.checked_in_at,
              checked_in_by: doc.checked_in_by,
            };
          }
          doc.checked_in = true;
          doc.checked_in_at = new Date().toISOString();
          doc.checked_in_by = staffEmail;
          return {
            status: 'VALID',
            ticket_id: doc.ticket_id,
            name: doc.name,
            email: doc.email,
            checked_in_at: doc.checked_in_at,
          };
        }
      }
      return { status: 'NOT_FOUND' };
    },
  };
}

async function withServer(overrides, fn) {
  const store = overrides.store || createInMemoryStore();
  const server = createTicketServer({
    googleClientId: 'test-client-id.apps.googleusercontent.com',
    hmacSecret: TEST_HMAC_SECRET,
    recaptchaSecretKey: 'test-recaptcha-secret',
    allowedOrigins: [ORIGIN],
    staffEmails: new Set(['staff@gdgcloudbkk.space']),
    store,
    verifyGoogleTokenFn: async (token) => {
      if (token === VALID_DUMMY_JWT) {
        return {
          sub: '109876543210987654321',
          email: 'attendee@example.com',
          name: sanitizeDisplayName('Alice <script>alert(1)</script> Dev'),
        };
      }
      if (token === STAFF_JWT) {
        return {
          sub: '999999999999999999999',
          email: 'staff@gdgcloudbkk.space',
          name: 'GDG Organizer',
        };
      }
      throw new Error('Invalid token');
    },
    verifyRecaptchaFn: async (token) => {
      if (token === 'valid-recaptcha-token-1234567890') {
        return { success: true, score: 0.9 };
      }
      return { success: false, reason: 'Bot detected (score < 0.5)' };
    },
    ...overrides,
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('1. Deterministic Ticket ID & Constant-Time HMAC QR Verification', () => {
  const sub = '109876543210987654321';
  const id1 = deriveDeterministicTicketId(sub, TEST_HMAC_SECRET);
  const id2 = deriveDeterministicTicketId(sub, TEST_HMAC_SECRET);
  assert.equal(id1, id2);
  assert.match(id1, /^DFBKK26-[A-F0-9]{8}$/);

  const qr1 = signTicketPayload(id1, 'Attendee@Example.com', TEST_HMAC_SECRET);
  const qr2 = signTicketPayload(id2, 'attendee@example.com', TEST_HMAC_SECRET);
  assert.equal(qr1, qr2, 'QR payload must be 100% deterministic every time');

  const verified = verifyTicketPayload(qr1, TEST_HMAC_SECRET);
  assert.equal(verified.valid, true);
  assert.equal(verified.ticketId, id1);
  assert.equal(verified.email, 'attendee@example.com');

  // Tamper 1 character in ticket_id
  const tampered = qr1.replace(id1, 'DFBKK26-00000000');
  assert.equal(verifyTicketPayload(tampered, TEST_HMAC_SECRET).valid, false);

  // Tamper email
  const tamperedEmail = qr1.replace('attendee@example.com', 'hacker@example.com');
  assert.equal(verifyTicketPayload(tamperedEmail, TEST_HMAC_SECRET).valid, false);
});

test('2. XSS Sanitization & GFE Last-Hop X-Forwarded-For Extraction', () => {
  const clean = sanitizeDisplayName('Alice <img src=x onerror=alert(1)>');
  assert.equal(clean.includes('<'), false);
  assert.equal(clean.includes('>'), false);

  // Attacker spoofs 1.2.3.4, Cloud Run GFE appends real IP 203.0.113.50 at the end
  const fakeReq = {
    headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 203.0.113.50' },
  };
  assert.equal(getClientIp(fakeReq), '203.0.113.50');
});

test('3. Rejects unauthorized Origin (CORS defense)', async () => {
  await withServer({}, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/ticket`, {
      method: 'POST',
      headers: {
        Origin: 'https://evil-attacker.com',
        Authorization: `Bearer ${VALID_DUMMY_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recaptchaToken: 'valid-recaptcha-token-1234567890' }),
    });
    assert.equal(resp.status, 403);
  });
});

test('4. Rejects missing/malformed JWT & oversized payload (>4KB)', async () => {
  await withServer({}, async (baseUrl) => {
    const badAuth = await fetch(`${baseUrl}/ticket`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: 'Bearer not-a-jwt' },
      body: JSON.stringify({}),
    });
    assert.equal(badAuth.status, 401);

    const giantBody = 'x'.repeat(5000);
    const tooLarge = await fetch(`${baseUrl}/ticket`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${VALID_DUMMY_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recaptchaToken: giantBody }),
    });
    assert.equal(tooLarge.status, 413);
  });
});

test('5. Rejects bot registration without valid reCAPTCHA v3 token', async () => {
  await withServer({}, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/ticket`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${VALID_DUMMY_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recaptchaToken: 'bot-token' }),
    });
    assert.equal(resp.status, 403);
  });
});

test('6. Ignores tampered body identity & returns identical QR on repeat logins + Staff Check-in', async () => {
  await withServer({}, async (baseUrl) => {
    // 1. Register with tampered body attempting to spoof email/name
    const reg1 = await fetch(`${baseUrl}/ticket`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${VALID_DUMMY_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recaptchaToken: 'valid-recaptcha-token-1234567890',
        email: 'spoofed-ceo@google.com',
        name: 'Spoofed Admin',
        ticket_id: 'DFBKK26-FFFFFFFF',
      }),
    });
    assert.equal(reg1.status, 200);
    const data1 = await reg1.json();

    // Must use verified JWT email, NOT body email
    assert.equal(data1.email, 'attendee@example.com');
    assert.equal(data1.name.includes('<script>'), false);

    // 2. Second login (even without reCAPTCHA token since already registered) returns identical QR
    const reg2 = await fetch(`${baseUrl}/ticket`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${VALID_DUMMY_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(reg2.status, 200);
    const data2 = await reg2.json();
    assert.equal(data1.ticket_id, data2.ticket_id);
    assert.equal(data1.qr_payload, data2.qr_payload);

    // 3. Non-staff attendee tries to call /checkin -> 403 Forbidden
    const nonStaffCheckin = await fetch(`${baseUrl}/checkin`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${VALID_DUMMY_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qr: data1.qr_payload }),
    });
    assert.equal(nonStaffCheckin.status, 403);

    // 4. Authorized Staff checks in attendee -> 200 VALID
    const staffCheckin1 = await fetch(`${baseUrl}/checkin`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${STAFF_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qr: data1.qr_payload }),
    });
    assert.equal(staffCheckin1.status, 200);
    const checkinRes1 = await staffCheckin1.json();
    assert.equal(checkinRes1.status, 'VALID');

    // 5. Second scan of same QR code -> 200 ALREADY_USED
    const staffCheckin2 = await fetch(`${baseUrl}/checkin`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${STAFF_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qr: data1.qr_payload }),
    });
    assert.equal(staffCheckin2.status, 200);
    const checkinRes2 = await staffCheckin2.json();
    assert.equal(checkinRes2.status, 'ALREADY_USED');
  });
});

test('7. Rate Limiter blocks brute-force floods with 429 Too Many Requests', async () => {
  await withServer({}, async (baseUrl) => {
    let statuses = [];
    for (let i = 0; i < 15; i++) {
      const r = await fetch(`${baseUrl}/ticket`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          'X-Forwarded-For': '198.51.100.77',
          Authorization: 'Bearer invalid',
        },
      });
      statuses.push(r.status);
    }
    assert.equal(statuses.includes(429), true, 'Flood must trigger 429 rate limit');
  });
});
