# Architecture & Technical Design Document - DevFestVerse

## Overview
**DevFestVerse** is an interactive 2D pixel-art virtual event platform built for **GDG Cloud Bangkok**. Deployed on **Google Cloud Platform (Cloud Run microservices)**, it provides an immersive retro game experience featuring custom SVG agent avatars with idle bobbing animations, GDG Cloud Bangkok community billboards (social links with embedded iframe modals & new tab buttons), sponsor booths, session-linked Gemini transcriptions by speaker, workshop room seat reservations, background music (YouTube/GCS audio), and role-based access control.

---

## High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Installable PWA & Responsive Mobile)"]
        Canvas2D["2D Canvas Engine (Multi-Direction Sprites, Hotspots & Mini-Map Radar)"]
        TouchControls["Mobile Touch Engine (Virtual D-Pad, Tap-to-Move & Action Button)"]
        BottomNav["Mobile Bottom Tab Navigation (World, Agenda, Labs, Studio, More)"]
        SW["Service Worker (PWA Caching & Web Push Listener)"]
        UI_Modals["Responsive Modals (Multi-Track Agenda, Workshops, Character Studio, Backoffice)"]
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
        WorkshopSvc["Workshop Seat Reservation & Cancellation Engine"]
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

## Google Sign-In & Character Studio Onboarding Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Participant / Attendee
    participant Client as Web Client (PWA / Canvas)
    participant AuthAPI as Auth Service (/api/v1/auth)
    participant AvatarAPI as Avatar Service (/api/v1/avatar)
    participant Gemini as Google Vertex AI / Gemini

    User->>Client: Open DevFestVerse / Click Google Sign-In
    Client->>AuthAPI: POST /auth/google-login (OAuth token, email, name)
    AuthAPI-->>Client: 200 OK (User Profile + Default AvatarConfig)
    
    User->>Client: Open 2D Character Studio
    alt Prompt-Based Generation
        User->>Client: Enters Prompt: "Google Cloud Architect with VR visor"
        Client->>AvatarAPI: POST /avatar/ai-generate { prompt }
        AvatarAPI->>Gemini: Synthesize Character Attributes & Theme
        Gemini-->>AvatarAPI: Palette, Hair, Headwear, Aura, Outfit
        AvatarAPI-->>Client: Updated AvatarConfig + SVG Avatar
    else Interactive Customizer
        User->>Client: Selects Skin, Hairstyle, GDG Hoodie, Space Helmet, Pet
        Client->>Client: Real-Time Animated Preview Render
        User->>Client: Clicks "Save & Apply Look"
        Client->>AvatarAPI: POST /avatar/customize { AvatarConfig }
        AvatarAPI-->>Client: 200 OK (Persisted AvatarConfig + SVG)
    end
    Client->>Client: Renders 4-Way Multi-Directional Sprite on 2D Tech Campus Map
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
   - `avatar_config`: JSON (`skin_tone`, `hair_style`, `hair_color`, `outfit_style`, `outfit_color`, `headwear`, `aura`, `theme`)
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
- **Google OAuth2 & Identity Integration**: User authenticates with Google Identity Services; backend synchronizes user account and avatar configuration.
- **Invitation Token Validation**: Organizers generate HMAC-signed token URLs (`/invite/speaker?token=...`, `/invite/sponsor?token=...`, `/invite/staff?token=...`). Redemption validates signature and updates user role in DB.

---

## Multi-Track Agenda & Personalized "My Agenda" Architecture

```mermaid
graph TD
    subgraph FrontendUI ["DevFest Agenda UI"]
        TrackSelector["Track Filters (🌐 All, Keynote, Track 1: AI, Track 2: Cloud, Track 3: Web)"]
        MyAgendaTab["⭐ My Agenda Tab (Cross-Track Aggregator)"]
        SearchFilter["Instant Real-Time Search (Title, Speaker, Track, Keyword)"]
        FavButton["❤️ Favorite Heart Button (Instant Toggle)"]
        LiveTranscriptsBtn["📜 Gemini Live Transcripts Modal"]
    end

    subgraph BackendServices ["FastAPI Backend Services"]
        SessionsAPI["GET /sessions?track={track}"]
        TracksAPI["GET /sessions/tracks"]
        FavToggleAPI["POST /sessions/{id}/favorite"]
        FavListAPI["GET /sessions/favorites"]
        AdminSessionCRUD["POST/PUT/DELETE /sessions (Back Office RBAC)"]
    end

    subgraph Storage ["Cloud SQL PostgreSQL"]
        SDB[("Sessions Table (id, title, track, room, start_time, end_time, speaker_name)")]
        UDB[("User Profile (id, favorite_sessions: JSONB/Array)")]
    end

    TrackSelector --> SessionsAPI
    MyAgendaTab --> FavListAPI
    FavButton --> FavToggleAPI
    FavToggleAPI --> UDB
    FavListAPI --> UDB
    FavListAPI --> SDB
    SessionsAPI --> SDB
    AdminSessionCRUD --> SDB
```

### Multi-Track & Back Office Flow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Organizer / Staff
    actor User as Participant
    participant Client as Frontend PWA
    participant API as Sessions Service (/api/v1/sessions)
    participant DB as Cloud SQL Database

    Note over Admin,DB: Back Office Schedule Configuration
    Admin->>Client: Open Back Office -> Manage Agenda & Tracks
    Admin->>Client: Input Session (Title, Track, Time, Room, Speaker)
    Client->>API: POST /api/v1/sessions or PUT /api/v1/sessions/{id}
    API->>DB: Upsert Session Record
    API-->>Client: 200 OK (Updated Session)
    Client-->>Admin: Show Success Toast & Update Admin Table

    Note over User,DB: Participant Multi-Track & Favorites Flow
    User->>Client: Open Agenda Modal
    Client->>API: GET /sessions & GET /sessions/favorites
    API-->>Client: Return Multi-Track Sessions + User Favorite IDs
    User->>Client: Click Track Tab (e.g. "Track 1: AI & Agents")
    Client->>Client: Filter sessions for selected track
    User->>Client: Click ❤️ Favorite on Session
    Client->>API: POST /sessions/{id}/favorite
    API->>DB: Toggle ID in User.favorite_sessions
    API-->>Client: 200 OK (is_favorite: true)
    User->>Client: Click "⭐ My Agenda" Tab
    Client->>Client: Render all favorited talks across all conference tracks
```

---

## Firestore Event Document Hierarchy & Attendance Tracking

The database on Google Cloud Firestore uses the **Event Name / Slug as the top-level document key** under the `events` collection.

```mermaid
graph TD
    subgraph FirestoreRoot ["Google Cloud Firestore: Collection ('events')"]
        EventDoc["Document: events/{event_id} (e.g. 'devfest-bangkok-2026')"]
    end

    subgraph EventPayload ["Top-Level Event Document Fields"]
        EventMeta["Metadata: {theme, year, organizer, expected_capacity, registration_url}"]
        EventDate["Date: '2026-11-28'"]
        EventVenue["Venue: {name, address, rooms: ['Grand Ballroom', 'Room A1', 'Room B1', ...]}"]
        EventSpeakers["Speakers: [ {id, name, title, bio, avatar_url}, ... ]"]
        EventSessions["Sessions: [ {id, title, track, room, start_time, end_time, speaker_name}, ... ]"]
        EventSponsors["Sponsors: [ {id, name, tier, booth_url, description}, ... ]"]
        EventWorkshops["Workshops: [ {id, title, instructor, capacity, reserved_count, room_code}, ... ]"]
        EventSummary["Attendance Summary: {total_registered, total_attended, show_up_rate_percent, absent_count}"]
    end

    subgraph AttendanceSub ["Participants / Attendance Map on Date"]
        Partic1["Participant: user-partic-1<br/>ticket_ref: 'TICKET-DEV-001'<br/>attended: true<br/>checked_in_at: '2026-11-28T09:15:30Z'<br/>scanned_by: 'user-staff-1'"]
        Partic2["Participant: user-partic-2<br/>ticket_ref: 'TICKET-DEV-002'<br/>attended: false<br/>checked_in_at: null<br/>scanned_by: null"]
    end

    EventDoc --> EventMeta
    EventDoc --> EventDate
    EventDoc --> EventVenue
    EventDoc --> EventSpeakers
    EventDoc --> EventSessions
    EventDoc --> EventSponsors
    EventDoc --> EventWorkshops
    EventDoc --> EventSummary
    EventDoc --> AttendanceSub
```

### Participant Check-In & Show-Up Rate Tracking Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Participant
    actor Staff as Staff / Organizer (Gate Scanner)
    participant Client as Back Office Console
    participant API as Firestore API (/api/v1/firestore/events)
    participant FS as Google Cloud Firestore

    Note over Attendee,FS: On Event Date (Check-In & Attendance)
    Attendee->>Staff: Shows Ticket QR / Reference (TICKET-DEV-001)
    Staff->>Client: Enters / Scans Ticket Ref into Check-In Scanner
    Client->>API: POST /firestore/events/{event_id}/checkin {ticket_ref: "TICKET-DEV-001"}
    API->>FS: Update participant.attended=true, checked_in_at=NOW, scanned_by=Staff.id
    API->>FS: Recalculate show_up_rate_percent = (total_attended / total_registered) * 100
    API-->>Client: 200 OK with updated participant and live attendance_summary
    Client-->>Staff: Live Success Toast & Updates Attendance Dashboard (Show-Up Rate %)
```

---

## Google Cloud Run Deployment Architecture

Deployed to **Google Cloud Platform (GCP)** under project `gdg-cloud-bangkok-2026` with cost-optimized scaling to 0 and single instance capping.

```mermaid
graph LR
    subgraph DevMachine ["Local / CI Pipeline"]
        SourceCode["Codebase (uv, FastAPI, Static PWA)"]
        DeployScript["deploy.sh / cloudbuild.yaml"]
    end

    subgraph GCP ["Google Cloud Platform (Project: gdg-cloud-bangkok-2026)"]
        CloudBuild["Cloud Build (Docker Container Build)"]
        ArtifactReg["Artifact Registry / Container Registry (gcr.io)"]
        CloudRun["Google Cloud Run: 'devfestverse'<br/>Region: asia-southeast3<br/>Min Instances: 0 (Scale-to-Zero)<br/>Max Instances: 1<br/>Memory: 512Mi | CPU: 1"]
        FirestoreDB[("Cloud Firestore (Top-Level Event & Attendance)")]
    end

    SourceCode --> DeployScript
    DeployScript --> CloudBuild
    CloudBuild --> ArtifactReg
    ArtifactReg --> CloudRun
    CloudRun --> FirestoreDB
```

---

## Verification & Test Plan

Automated test suites covering all microservice endpoints:
- `backend/tests/test_auth_invites.py`: Tests user registration, role promotion, and invitation link generation.
- `backend/tests/test_tickets.py`: Tests official ticket reference verification.
- `backend/tests/test_billboards_sponsors.py`: Tests community billboard links and sponsor booth configurations.
- `backend/tests/test_firestore_events.py`: Tests top-level Firestore event hierarchy, date/venue metadata updates, and participant check-in / live show-up rate calculations.
- `backend/tests/test_workshops.py`: Tests workshop seat capacity reservations and cancellation.
- `backend/tests/test_sessions_transcribe.py`: Tests multi-track agenda filtering, favorites toggle, backoffice session CRUD, and Gemini transcript streaming.
- `backend/tests/test_backoffice_apis.py`: Tests role changes, lessons learned retrospectives, active user tracking, and RBAC enforcement.
- `backend/tests/test_avatar_auth.py`: Tests 2D avatar customization, Google sign-in integration, and Gemini AI avatar synthesis.



