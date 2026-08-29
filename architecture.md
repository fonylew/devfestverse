# Architecture & Technical Design Document - DevFestVerse

## Overview
**DevFestVerse** is an interactive 2D pixel-art virtual event platform built for **GDG Cloud Bangkok**. Deployed on **Google Cloud Platform (Cloud Run microservices)**, it provides an immersive retro game experience featuring custom SVG agent avatars with idle bobbing animations, GDG Cloud Bangkok community billboards (social links with embedded iframe modals & new tab buttons), sponsor booths, session-linked Gemini transcriptions by speaker, workshop room seat reservations, background music (YouTube/GCS audio), and role-based access control.

---

## High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Installable PWA)"]
        Canvas2D["2D Canvas Engine (Idle Bobbing Sprites, Map & Hotspots)"]
        SW["Service Worker (PWA Caching & Web Push Listener)"]
        UI_Modals["Modals (Ticket Check, Community & Sponsor Iframe, Q&A, Workshops)"]
    end

    subgraph AuthLayer ["Authentication & Role Onboarding"]
        GoogleAuth["Google Sign-In (OAuth2 / Identity Platform)"]
        ParticReg["Simple Participant Register Link (/register)"]
        InviteLinks["Role Invite Link System (/invite/speaker, /sponsor, /staff)"]
    end

    subgraph GCPCloudRun ["Google Cloud Platform - Cloud Run Microservices"]
        AuthRBAC["Auth & RBAC Middleware (5 Roles: Organizer, Staff, Speaker, Sponsor, Participant)"]
        TicketSvc["Main Event Ticket Verification Service"]
        BillboardSvc["Community Billboard & Sponsor Service"]
        WorkshopSvc["Workshop Seat Reservation Engine"]
        SessionSvc["Agenda & Session Service"]
        TranscribeSvc["Session-Linked Gemini Transcribe Pipeline"]
        AnnounceSvc["Public & Staff Announcement Channels"]
        BackofficeAPIs["Comprehensive Back Office APIs"]
    end

    subgraph AIIntegrations ["Google Vertex AI & Gemini"]
        GeminiTranscribe["Gemini Live Transcribe API"]
        GeminiAvatar["Gemini Photo-to-SVG Avatar Engine"]
    end

    subgraph DataStorage ["Data & Storage Layer"]
        CloudSQL[("Cloud SQL PostgreSQL (Users, Roles, Agenda, Transcripts, Tickets)")]
        Firestore[("Cloud Firestore (Q&A Queue, Workshops, Announcements)")]
        Redis[("Cloud MemoryStore (WebSockets, Active User Presence, Seat Holds)")]
        GCS[("Cloud Storage (SVG Assets, Avatars, Audio Tracks)")]
    end

    Canvas2D --> SW
    UI_Modals --> AuthLayer
    AuthLayer --> AuthRBAC

    AuthRBAC --> TicketSvc
    AuthRBAC --> BillboardSvc
    AuthRBAC --> WorkshopSvc
    AuthRBAC --> SessionSvc
    AuthRBAC --> TranscribeSvc
    AuthRBAC --> AnnounceSvc
    AuthRBAC --> BackofficeAPIs

    TranscribeSvc --> GeminiTranscribe
    TicketSvc --> CloudSQL
    SessionSvc --> CloudSQL
    WorkshopSvc --> Redis
    WorkshopSvc --> CloudSQL
    BillboardSvc --> GCS
    AnnounceSvc --> Redis
```

---

## User Role Matrix (RBAC)

```mermaid
graph TD
    User["User Onboarding"] --> RoleCheck{"Assigned Role?"}
    
    RoleCheck -- Participant --> ParticPerms["Participant: 2D World, Avatar, Ticket Check, Q&A, Workshops, BGM"]
    RoleCheck -- Speaker --> SpeakerPerms["Speaker: Speaker Dashboard, Session Materials, Speaker Transcripts"]
    RoleCheck -- Sponsor --> SponsorPerms["Sponsor: Sponsor Booth Portal, Logo/Iframe Manager, Leads"]
    RoleCheck -- Staff --> StaffPerms["Staff: Staff Console, Internal Team Communication, Moderation, Workshop Check-in"]
    RoleCheck -- Organizer --> OrgPerms["Organizer: Full Back Office, Role Switcher, SVG Asset Studio, Lucky Draw, APIs"]
```

---

## Detailed Data Models & Entity Relationships

1. **User / Account (`users`)**:
   - `id`: UUID
   - `email`: String (Google OAuth)
   - `display_name`: String
   - `role`: Enum (`ORGANIZER`, `STAFF`, `SPEAKER`, `SPONSOR`, `PARTICIPANT`)
   - `verified_ticket`: Boolean (Status from Main Event Ticket Verification)
   - `ticket_ref`: String
   - `avatar_svg`: Text (SVG avatar markup)
   - `created_at`: Timestamp

2. **Agenda Session (`sessions`)**:
   - `id`: UUID
   - `event_id`: UUID
   - `title`: String
   - `description`: Text
   - `speaker_id`: UUID (FK `users.id`)
   - `start_time`: Timestamp
   - `end_time`: Timestamp

3. **Session Transcript (`transcripts`)**:
   - `id`: UUID
   - `session_id`: UUID (FK `sessions.id`)
   - `speaker_id`: UUID (FK `users.id`)
   - `transcript_text`: Text
   - `original_language`: String (e.g. `th`, `en`)
   - `translated_text`: Text
   - `timestamp`: Timestamp

4. **Community Billboard & Sponsor (`billboards`)**:
   - `id`: UUID
   - `event_id`: UUID
   - `category`: Enum (`COMMUNITY_FACEBOOK_PAGE`, `COMMUNITY_FACEBOOK_GROUP`, `COMMUNITY_DISCORD`, `COMMUNITY_INSTAGRAM`, `COMMUNITY_YOUTUBE`, `SPONSOR`)
   - `title`: String
   - `logo_svg`: Text / URL
   - `iframe_url`: String
   - `description`: Text
   - `position_x`: Integer
   - `position_y`: Integer

5. **Workshop Room (`workshops`)**:
   - `id`: UUID
   - `event_id`: UUID
   - `title`: String
   - `speaker_name`: String
   - `capacity`: Integer
   - `reserved_count`: Integer
   - `room_code`: String

---

## Security & Authentication Flow
- **Google OAuth2 & JWT Tokens**: User authenticates with Google Identity Services; backend issues a JWT token containing user ID and role claims.
- **Invitation Token Validation**: Organizers generate HMAC-signed token URLs (`/invite/speaker?token=...`, `/invite/sponsor?token=...`, `/invite/staff?token=...`). Redemption validates signature and updates user role in DB.
