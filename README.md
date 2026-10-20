# DevFest Bangkok 2026 — 3D Community World (`gdgcloudbkk.space`)

Interactive 3D voxel/plush Bangkok world built with **Three.js + Web Audio API** for **GDG Bangkok & GDG Cloud Bangkok (DevFest Bangkok 2026)**, hosted on GitHub Pages with a zero-trust Node.js 22 OAuth + Signed QR Ticket microservice on Google Cloud Run.

- **Live Production World:** [https://gdgcloudbkk.space/](https://gdgcloudbkk.space/) ([index.html](file:///home/fony/clone/devfestverse/index.html))
- **First Draft World:** [https://gdgcloudbkk.space/first_draft.html](https://gdgcloudbkk.space/first_draft.html) ([first_draft.html](file:///home/fony/clone/devfestverse/first_draft.html))
- **Sandbox with OAuth Registration & QR Ticket:** [https://gdgcloudbkk.space/dev.html](https://gdgcloudbkk.space/dev.html) ([dev.html](file:///home/fony/clone/devfestverse/dev.html))
- **GDG Staff QR Check-in Scanner:** [https://gdgcloudbkk.space/checkin.html](https://gdgcloudbkk.space/checkin.html) ([checkin.html](file:///home/fony/clone/devfestverse/checkin.html))
- **Security Architecture & Proof:** [SECURITY.md](file:///home/fony/clone/devfestverse/SECURITY.md)

---

## Setup Guide: Google OAuth, reCAPTCHA v3, Firestore & Cloud Run

Follow these steps in project **`gdg-cloud-bangkok-2026`** to activate live registration on `dev.html`:

### Step 1: Create / Update Google OAuth 2.0 Web Client ID
1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=gdg-cloud-bangkok-2026).
2. Click **+ Create Credentials → OAuth client ID** (Application type: **Web application**).
3. Under **Authorized JavaScript origins**, add:
   - `https://gdgcloudbkk.space`
4. Copy the generated **Client ID** (`xxxx.apps.googleusercontent.com`).

### Step 2: Create Google reCAPTCHA v3 Keys
1. Open [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create).
2. Select **Score based (v3)** and add domain `gdgcloudbkk.space`.
3. Copy the **Site Key** (public, goes in `dev.html`) and **Secret Key** (private, goes into Google Secret Manager via `deploy.sh`).

### Step 3: Ensure Firestore Native Database Exists
1. Open [Google Cloud Console → Firestore](https://console.cloud.google.com/firestore/databases?project=gdg-cloud-bangkok-2026).
2. If not created yet, create the `(default)` database in **Firestore Native mode** in region `asia-southeast1`.
3. Client-side access is locked down by [firestore.rules](file:///home/fony/clone/devfestverse/firestore.rules) (`allow read, write: if false;`).

### Step 4: Deploy the Node.js 22 Ticket Service to Cloud Run
Run the deployment script in [ticket-service/deploy.sh](file:///home/fony/clone/devfestverse/ticket-service/deploy.sh):
```bash
cd ticket-service
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com" \
RECAPTCHA_SECRET_KEY="your-recaptcha-secret-key" \
STAFF_EMAILS="your-organizer-email@gmail.com" \
./deploy.sh
```
This automatically stores `TICKET_HMAC_SECRET` and `RECAPTCHA_SECRET_KEY` in **Google Cloud Secret Manager** and deploys `devfest-ticket-service` with `--min-instances=0` and `--max-instances=1`.

### Step 5: Update Public Identifiers in `dev.html` & `checkin.html`
Replace the placeholder constants in `TICKET_CONFIG` inside `dev.html` (and `CONFIG` in `checkin.html`) with your public `googleClientId`, `recaptchaSiteKey`, and Cloud Run `ticketApiUrl`.

---

## Running Automated Security Tests
```bash
cd ticket-service
npm test
```
