# DevFestVerse - Productionization & Enhancement TODO List

This document lists all demo mock items, pending features, infrastructure tasks, and fixes required to fully productionize **DevFestVerse** for **GDG Cloud Bangkok**.

---

## 🚨 High Priority Tasks (Immediate Productionization)

- [ ] **Remove Mock Seed Test Roles**:
  - Remove hardcoded demo users (`user-org-1`, `user-staff-1`, `user-speaker-1`, "Dr. Speaker", `user-sponsor-1`).
  - Enforce real user resolution from Firebase Auth & Firestore DB.

- [ ] **Firebase Role Management & Admin Binding**:
  - Automatically bind configured `DEFAULT_ADMIN_EMAIL` to the `ORGANIZER` (Admin) role on login/lookup.
  - Default all newly registered users to the `PARTICIPANT` role.
  - Ensure Back Office role changes persist to Firestore `users` and `events` collections.

- [ ] **Fix Background Music (BGM) Engine**:
  - Replace non-functional external link buttons with an HTML5 Audio & Web Audio API playback engine in `frontend/src/app.js`.
  - Add user-interaction audio unlock listener, volume controls, mute toggle, and zone-based audio triggers.

- [ ] **2D Map & Asset Visual Enhancements**:
  - Upgrade 2D canvas rendering with textured floor tiles, paved pathways, branded GDG Cloud Bangkok Main Stage, styled Sponsor Booths, and enhanced Community Billboards.

---

## 🛠️ Infrastructure & Backend TODOs

- [ ] **GCP Firebase / Firestore Configuration**:
  - Configure GCP Service Account credentials (`GOOGLE_APPLICATION_CREDENTIALS`) for Cloud Run deployment.
  - Ensure production Firestore indexes are created for `events`, `users`, `qna`, and `feedbacks`.

- [ ] **Firebase Auth Token Verification**:
  - Verify Firebase Auth JWT tokens (`Bearer <id_token>`) in FastAPI dependency instead of header fallbacks.

- [ ] **Live Audio Transcription Pipeline**:
  - Replace mock transcript chunk string generator with real-time Gemini Multimodal Live API WebSocket audio stream handler.

- [ ] **Official DevFest Ticket Verification Integration**:
  - Connect ticket verification service to GDG Community Platform API / Firestore CSV ticket database.

- [ ] **Cloud Storage (GCS) Audio & SVG Uploads**:
  - Support direct GCS upload signed URLs for custom BGM audio tracks and user SVG pixel avatars.

---

## 🎨 Frontend & PWA TODOs

- [ ] **PWA Assets & Web Push Registration**:
  - Provide production 192x192 and 512x512 app icons for PWA installation.
  - Connect VAPID keys for browser Web Push notification registration.

- [ ] **Mobile Virtual Joystick**:
  - Add touch virtual D-pad / joystick for smooth mobile browser navigation.

- [ ] **Live Player Presence Overlay**:
  - Display multiplayer active player avatars on 2D map via WebSockets/Redis presence.
