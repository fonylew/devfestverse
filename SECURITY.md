# Security Architecture & White-Hat Design Proof

DevFest Bangkok 2026 (`https://gdgcloudbkk.space`) is an **open-source static 3D web experience** hosted on GitHub Pages, paired with a **zero-trust, minimal Node.js 22 serverless ticket microservice** on Google Cloud Run and a private Firestore database.

This document explains why **every line of code in this repository is safe to be 100% public** without allowing attackers to spoof identities, forge QR tickets, enumerate attendees, or abuse cloud billing.

---

## 1. Core Security Principles (Kerckhoffs's Principle)

A secure system must remain secure even if everything about the system, except the cryptographic keys, is public knowledge.

| Component | Visibility | Why It Cannot Be Abused |
| :--- | :--- | :--- |
| **Static Frontend (`index.html`, `dev.html`, `checkin.html`)** | Public (GitHub Pages) | Contains **zero database SDKs** and **zero secret keys**. Only holds public OAuth Client ID and reCAPTCHA v3 Site Key, which are domain-locked to `https://gdgcloudbkk.space`. |
| **Backend Source (`ticket-service/server.js`)** | Public (Open Source) | Trusts **zero client-supplied identity fields**. Extracts `sub`, `email`, and `name` exclusively from Google's RS256-signed JWT after cryptographic verification. |
| **Ticket Signing Key (`TICKET_HMAC_SECRET`)** | **Private** (Google Cloud Secret Manager) | 256-bit random key generated via `openssl rand -hex 32` and injected at runtime into Cloud Run memory. Never stored in Git. |
| **Firestore Database (`devfest2026_tickets`)** | **Private** (GCP IAM Only) | `firestore.rules` explicitly denies all client reads/writes (`allow read, write: if false;`). Only the Cloud Run backend service account can read or write documents. |

---

## 2. Red-Team Attack Vector Defenses

### A. Identity Spoofing & Parameter Tampering
- **Threat:** An attacker inspects `server.js` and sends a crafted `POST /ticket` body (`{"email": "victim@gmail.com", "name": "Admin", "ticket_id": "DFBKK26-00000000"}`).
- **Defense:** The backend completely ignores request body fields for identity. It verifies the `Authorization: Bearer <google_id_token>` header using `google-auth-library` against Google's rotating RS256 public keys (`https://www.googleapis.com/oauth2/v3/certs`), strictly enforcing:
  - `aud === GOOGLE_CLIENT_ID` (prevents cross-app token replay)
  - `iss` in `['accounts.google.com', 'https://accounts.google.com']`
  - `email_verified === true`

### B. Ticket QR Forgery & Timing Attacks
- **Threat:** An attacker tries to generate a fake QR code (`DFBKK26:<ticket_id>:<email>:<sig>`) or measure response timing to guess signature bytes.
- **Defense:**
  - Each QR payload is signed using `HMAC-SHA256` with the 256-bit `TICKET_HMAC_SECRET` stored in Secret Manager:
    $$\text{sig} = \text{HMAC-SHA256}(\text{TICKET\_HMAC\_SECRET},\ \text{"DFBKK26:"} \parallel \text{ticket\_id} \parallel \text{":"} \parallel \text{email})$$
  - Because `ticket_id` is deterministically derived from `HMAC-SHA256(TICKET_HMAC_SECRET, "TICKET_ID_V1:" + sub)`, the attendee receives the **exact same QR code pixel-for-pixel every time** they log in or click **Download Ticket**, while external forgery has a $2^{-256}$ probability.
  - On `/checkin`, signatures are compared using Node's native constant-time `crypto.timingSafeEqual()`.

### C. Automated Bot Registration & Brute-Force Flooding
- **Threat:** A botnet floods `POST /ticket` to exhaust Cloud Run / Firestore quotas or mass-register accounts.
- **Defense (5 Layers):**
  1. **Strict 4 KB Payload Ceiling:** Any request body exceeding `4096` bytes immediately destroys the socket (`413 Payload Too Large`) before JSON parsing.
  2. **Pre-Crypto Format Gate:** Malformed `Origin` or `Authorization` headers are rejected in `< 0.1ms` in memory before any network or database call.
  3. **GFE Last-Hop Real-IP Rate Limiting:** Extracts the Google Frontend (GFE) appended client IP (`x-forwarded-for.split(',').at(-1)`) so attackers cannot spoof `X-Forwarded-For` headers, enforcing a sliding window limit (`12 req/min/IP` and `8 req/min/user`) with bounded map eviction (`10,000` keys max) to prevent memory exhaustion.
  4. **Google reCAPTCHA v3 Bot Verification:** New ticket creation requires a valid server-verified reCAPTCHA v3 token with `action === 'register_ticket'`, `score >= 0.5`, and matching `hostname`.
  5. **Hard Cloud Run Instance Cap (`--max-instances=1`):** Ensures the service scales to zero on idle ($0 cost) and never scales beyond 1 container under a DDoS attack.

### D. Double Check-in Race Conditions (TOCTOU)
- **Threat:** Two people scan copies of the same QR code at two entrance gates at the exact same millisecond.
- **Defense:** Both `/ticket` creation and `/checkin` status updates execute inside **Firestore ACID Transactions (`db.runTransaction()`)**. Only the first scan transitions `checked_in: false → true`; any concurrent scan is serialized and returns `ALREADY_USED`.

### E. Stored / DOM Cross-Site Scripting (XSS)
- **Threat:** An attacker sets their Google Account display name to `<img src=x onerror=alert(1)>` to attack the organizer's scanner browser.
- **Defense:** Display names are stripped of `< >` and control characters on the server, and both `dev.html` and `checkin.html` render all user fields exclusively via `.textContent` (never `.innerHTML`).
