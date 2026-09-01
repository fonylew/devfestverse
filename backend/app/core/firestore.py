import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from backend.app.core.config import settings

try:
    from google.cloud import firestore
    HAS_FIRESTORE_LIB = True
except ImportError:
    HAS_FIRESTORE_LIB = False

# Seed users for in-memory / test fallback with multi-event multi-role support
IN_MEMORY_USERS: Dict[str, Dict[str, Any]] = {
    "user-org-1": {
        "id": "user-org-1",
        "email": "organizer@gdgcloudbkk.org",
        "display_name": "GDG Lead",
        "global_role": "ORGANIZER",
        "role": "ORGANIZER",
        "verified_ticket": True,
        "ticket_ref": "TICKET-DEV-001",
        "events": {
            "devfest-bangkok-2026": {
                "role": "ORGANIZER",
                "ticket_ref": "TICKET-DEV-001",
                "verified_ticket": True,
                "attended": True,
                "registered_at": "2026-08-01T00:00:00Z"
            },
            "gdg-ai-hackathon-2026": {
                "role": "ORGANIZER",
                "ticket_ref": "TICKET-HACK-001",
                "verified_ticket": True,
                "attended": False,
                "registered_at": "2026-08-15T00:00:00Z"
            }
        },
        "auth_provider": "google",
        "created_at": "2026-08-01T00:00:00Z",
        "updated_at": "2026-08-01T00:00:00Z",
        "is_active": True
    },
    "user-staff-1": {
        "id": "user-staff-1",
        "email": "staff@gdgcloudbkk.org",
        "display_name": "Event Staff",
        "global_role": "STAFF",
        "role": "STAFF",
        "verified_ticket": True,
        "ticket_ref": "TICKET-DEV-002",
        "events": {
            "devfest-bangkok-2026": {
                "role": "STAFF",
                "ticket_ref": "TICKET-DEV-002",
                "verified_ticket": True,
                "attended": True,
                "registered_at": "2026-08-05T00:00:00Z"
            }
        },
        "auth_provider": "local",
        "created_at": "2026-08-05T00:00:00Z",
        "updated_at": "2026-08-05T00:00:00Z",
        "is_active": True
    },
    "user-speaker-1": {
        "id": "user-speaker-1",
        "email": "speaker@ai-agents.io",
        "display_name": "Dr. Agent",
        "global_role": "PARTICIPANT",
        "role": "SPEAKER",
        "verified_ticket": True,
        "ticket_ref": "TICKET-DEV-003",
        "events": {
            "devfest-bangkok-2026": {
                "role": "SPEAKER",
                "ticket_ref": "TICKET-DEV-003",
                "verified_ticket": True,
                "attended": True,
                "registered_at": "2026-08-10T00:00:00Z"
            },
            "gdg-ai-hackathon-2026": {
                "role": "PARTICIPANT",
                "ticket_ref": "TICKET-HACK-SPK",
                "verified_ticket": True,
                "attended": False,
                "registered_at": "2026-08-20T00:00:00Z"
            }
        },
        "auth_provider": "google",
        "created_at": "2026-08-10T00:00:00Z",
        "updated_at": "2026-08-10T00:00:00Z",
        "is_active": True
    },
    "user-sponsor-1": {
        "id": "user-sponsor-1",
        "email": "sponsor@google.com",
        "display_name": "Google Cloud",
        "global_role": "PARTICIPANT",
        "role": "SPONSOR",
        "verified_ticket": True,
        "ticket_ref": "TICKET-DEV-004",
        "events": {
            "devfest-bangkok-2026": {
                "role": "SPONSOR",
                "ticket_ref": "TICKET-DEV-004",
                "verified_ticket": True,
                "attended": True,
                "registered_at": "2026-08-15T00:00:00Z"
            }
        },
        "auth_provider": "google",
        "created_at": "2026-08-15T00:00:00Z",
        "updated_at": "2026-08-15T00:00:00Z",
        "is_active": True
    },
    "user-partic-1": {
        "id": "user-partic-1",
        "email": "dev@bangkok.io",
        "display_name": "Pixel Dev",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT",
        "verified_ticket": False,
        "ticket_ref": None,
        "events": {
            "devfest-bangkok-2026": {
                "role": "PARTICIPANT",
                "ticket_ref": "TICKET-DEV-001",
                "verified_ticket": False,
                "attended": False,
                "registered_at": "2026-08-20T10:00:00Z"
            },
            "gdg-ai-hackathon-2026": {
                "role": "SPEAKER",
                "ticket_ref": "TICKET-HACK-DEV",
                "verified_ticket": True,
                "attended": False,
                "registered_at": "2026-08-25T10:00:00Z"
            }
        },
        "auth_provider": "local",
        "created_at": "2026-08-20T10:00:00Z",
        "updated_at": "2026-08-20T10:00:00Z",
        "is_active": True
    },
    "user-partic-2": {
        "id": "user-partic-2",
        "email": "sara@devfest.th",
        "display_name": "Sara Cloud",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT",
        "verified_ticket": True,
        "ticket_ref": "TICKET-DEV-002",
        "events": {
            "devfest-bangkok-2026": {
                "role": "PARTICIPANT",
                "ticket_ref": "TICKET-DEV-002",
                "verified_ticket": True,
                "attended": True,
                "registered_at": "2026-08-21T11:00:00Z"
            },
            "cloud-community-day-2026": {
                "role": "STAFF",
                "ticket_ref": "TICKET-CCD-001",
                "verified_ticket": True,
                "attended": False,
                "registered_at": "2026-08-28T09:00:00Z"
            }
        },
        "auth_provider": "google",
        "created_at": "2026-08-21T11:00:00Z",
        "updated_at": "2026-08-21T11:00:00Z",
        "is_active": True
    }
}

# Multi-event seed store in Firestore
IN_MEMORY_FIRESTORE: Dict[str, Dict[str, Any]] = {
    "devfest-bangkok-2026": {
        "event_id": "devfest-bangkok-2026",
        "event_name": "GDG Cloud Bangkok DevFest 2026",
        "date": "2026-11-28",
        "venue": {
            "name": "True Digital Park Grand Hall & DevFest Virtual Tech Campus",
            "address": "101 Sukhumvit Road, Bang Chak, Phra Khanong, Bangkok 10260",
            "rooms": ["Grand Ballroom", "Room A1", "Room B1", "Room C1", "Room W1", "Room W2"]
        },
        "metadata": {
            "theme": "AI Agentverse & Google Cloud Scale",
            "year": 2026,
            "organizer": "GDG Cloud Bangkok",
            "expected_capacity": 1200,
            "registration_url": "https://gdg.community.dev/events/details/google-gdg-cloud-bangkok-presents-devfest-bangkok/",
            "status": "PUBLISHED"
        },
        "speakers": [
            {
                "id": "spk-1",
                "name": "Dr. Agent",
                "title": "Google Cloud AI Architect",
                "bio": "Specialist in Gemini 2.0, Multi-Agent Systems, and AlloyDB Vector Search.",
                "avatar_url": "/assets/avatars/dr-agent.png"
            },
            {
                "id": "spk-2",
                "name": "GDG Lead",
                "title": "Community Organizer & Cloud Specialist",
                "bio": "Leading GDG Cloud Bangkok community architectures on Cloud Run.",
                "avatar_url": "/assets/avatars/gdg-lead.png"
            }
        ],
        "sessions": [
            {
                "id": "session-keynote",
                "title": "Opening Keynote: Autonomous AI Agents & Cloud Scale",
                "track": "Main Keynote",
                "room": "Grand Ballroom",
                "start_time": "09:30 AM",
                "end_time": "10:30 AM",
                "speaker_name": "Dr. Agent"
            },
            {
                "id": "session-gemini-live",
                "title": "Building Realtime Multimodal Streaming with Gemini Live API",
                "track": "Track 1: AI & Agents",
                "room": "Room A1",
                "start_time": "10:45 AM",
                "end_time": "11:45 AM",
                "speaker_name": "Dr. Agent"
            },
            {
                "id": "session-cloudrun-micro",
                "title": "Deploying Resilient Microservices on Google Cloud Run",
                "track": "Track 2: Cloud & DevOps",
                "room": "Room B1",
                "start_time": "10:45 AM",
                "end_time": "11:45 AM",
                "speaker_name": "GDG Lead"
            }
        ],
        "sponsors": [
            {
                "id": "sp-google-cloud",
                "name": "Google Cloud",
                "tier": "TITLE_SPONSOR",
                "booth_url": "https://cloud.google.com",
                "description": "Transform your business with Vertex AI, AlloyDB, and Cloud Run."
            },
            {
                "id": "sp-gdg-bangkok",
                "name": "GDG Cloud Bangkok",
                "tier": "COMMUNITY_HOST",
                "booth_url": "https://gdg.community.dev",
                "description": "Empowering developers across Thailand."
            }
        ],
        "workshops": [
            {
                "id": "ws-1",
                "title": "Hands-on: Building AI Agents with ADK & Gemini 2.0",
                "instructor": "Google Cloud Architect",
                "capacity": 30,
                "reserved_count": 12,
                "room_code": "Room W1"
            }
        ],
        "participants": {
            "user-partic-1": {
                "user_id": "user-partic-1",
                "ticket_ref": "TICKET-DEV-001",
                "name": "Pixel Dev",
                "email": "dev@bangkok.io",
                "role": "PARTICIPANT",
                "registered_at": "2026-08-20T10:00:00Z",
                "attended": False,
                "checked_in_at": None,
                "scanned_by": None
            },
            "user-partic-2": {
                "user_id": "user-partic-2",
                "ticket_ref": "TICKET-DEV-002",
                "name": "Sara Cloud",
                "email": "sara@devfest.th",
                "role": "PARTICIPANT",
                "registered_at": "2026-08-21T11:00:00Z",
                "attended": True,
                "checked_in_at": "2026-11-28T09:15:30Z",
                "scanned_by": "user-staff-1"
            }
        }
    },
    "gdg-ai-hackathon-2026": {
        "event_id": "gdg-ai-hackathon-2026",
        "event_name": "GDG Bangkok AI Agent Hackathon 2026",
        "date": "2026-12-05",
        "venue": {
            "name": "Google Developer Space Bangkok",
            "address": "Gaysorn Tower, Ploenchit Road, Bangkok",
            "rooms": ["Main Arena", "Hacking Lab 1", "Mentorship Room"]
        },
        "metadata": {
            "theme": "Autonomous Agent Swarms & Gemini 2.0 Multimodal",
            "year": 2026,
            "organizer": "GDG Cloud Bangkok",
            "expected_capacity": 250,
            "status": "PUBLISHED"
        },
        "speakers": [
            {
                "id": "spk-hack-1",
                "name": "Pixel Dev",
                "title": "Hackathon Keynote Speaker & Agent Architect",
                "bio": "Building fast prototypes with Gemini API.",
                "avatar_url": "/assets/avatars/pixel-dev.png"
            }
        ],
        "sessions": [
            {
                "id": "hack-keynote",
                "title": "Hackathon Kickoff: Building Autonomous Multi-Agent Workflows",
                "track": "Hackathon Main Track",
                "room": "Main Arena",
                "start_time": "09:00 AM",
                "end_time": "10:00 AM",
                "speaker_name": "Pixel Dev"
            }
        ],
        "sponsors": [
            {
                "id": "sp-google-ai",
                "name": "Google Cloud AI",
                "tier": "PLATINUM_SPONSOR",
                "booth_url": "https://cloud.google.com/ai",
                "description": "Vertex AI and Gemini for Hackathon builders."
            }
        ],
        "workshops": [],
        "participants": {
            "user-partic-1": {
                "user_id": "user-partic-1",
                "ticket_ref": "TICKET-HACK-DEV",
                "name": "Pixel Dev",
                "email": "dev@bangkok.io",
                "role": "SPEAKER",
                "registered_at": "2026-08-25T10:00:00Z",
                "attended": False,
                "checked_in_at": None,
                "scanned_by": None
            }
        }
    },
    "cloud-community-day-2026": {
        "event_id": "cloud-community-day-2026",
        "event_name": "Google Cloud Community Day Bangkok 2026",
        "date": "2026-10-15",
        "venue": {
            "name": "Queen Sirikit National Convention Center (QSNCC)",
            "address": "60 Ratchadaphisek Rd, Khlong Toei, Bangkok 10110",
            "rooms": ["Plenary Hall", "Breakout A", "Breakout B"]
        },
        "metadata": {
            "theme": "Enterprise Cloud Migration & Serverless Scale",
            "year": 2026,
            "organizer": "GDG Cloud Bangkok",
            "expected_capacity": 800,
            "status": "PUBLISHED"
        },
        "speakers": [],
        "sessions": [],
        "sponsors": [],
        "workshops": [],
        "participants": {
            "user-partic-2": {
                "user_id": "user-partic-2",
                "ticket_ref": "TICKET-CCD-001",
                "name": "Sara Cloud",
                "email": "sara@devfest.th",
                "role": "STAFF",
                "registered_at": "2026-08-28T09:00:00Z",
                "attended": False,
                "checked_in_at": None,
                "scanned_by": None
            }
        }
    }
}

class FirestoreEventManager:
    def __init__(self, project_id: Optional[str] = None):
        self.project_id = project_id or os.getenv("GCP_PROJECT", settings.GCP_PROJECT)
        self._db = None
        self.users_collection_name = settings.FIRESTORE_USERS_COLLECTION
        self.events_collection_name = settings.FIRESTORE_EVENTS_COLLECTION
        
        # Initialize Google Cloud Firestore client if running with GCP ADC
        if HAS_FIRESTORE_LIB:
            try:
                self._db = firestore.Client(project=self.project_id)
            except Exception:
                self._db = None

    def is_configured(self) -> bool:
        """Check if Firestore client or in-memory database is active."""
        return True

    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Fetch full top-level event document by event name/ID."""
        if self._db:
            try:
                doc = self._db.collection("events").document(event_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    participants = data.get("participants", {})
                    data["attendance_summary"] = self._calculate_attendance_summary(participants)
                    return data
            except Exception:
                pass

        # In-memory fallback
        event = IN_MEMORY_FIRESTORE.get(event_id)
        if event:
            event_copy = dict(event)
            event_copy["attendance_summary"] = self._calculate_attendance_summary(event.get("participants", {}))
            return event_copy
        return None

    def list_all_events(self) -> List[Dict[str, Any]]:
        """List all top-level event records."""
        if self._db:
            try:
                docs = self._db.collection("events").stream()
                results = []
                for d in docs:
                    data = d.to_dict()
                    data["attendance_summary"] = self._calculate_attendance_summary(data.get("participants", {}))
                    results.append(data)
                if results:
                    return results
            except Exception:
                pass
        
        results = []
        for e in IN_MEMORY_FIRESTORE.values():
            copy_e = dict(e)
            copy_e["attendance_summary"] = self._calculate_attendance_summary(e.get("participants", {}))
            results.append(copy_e)
        return results

    def upsert_event(self, event_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create or replace top-level event document on Firestore."""
        event_record = {
            "event_id": event_id,
            "event_name": payload.get("event_name", event_id),
            "date": payload.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "venue": payload.get("venue", {
                "name": "DevFest Convention Center & Virtual Campus",
                "address": "Bangkok, Thailand",
                "rooms": ["Grand Ballroom", "Room A1", "Room B1"]
            }),
            "metadata": payload.get("metadata", {}),
            "speakers": payload.get("speakers", []),
            "sessions": payload.get("sessions", []),
            "sponsors": payload.get("sponsors", []),
            "workshops": payload.get("workshops", []),
            "participants": payload.get("participants", {})
        }

        if self._db:
            try:
                self._db.collection("events").document(event_id).set(event_record, merge=True)
            except Exception:
                pass

        IN_MEMORY_FIRESTORE[event_id] = event_record
        event_record["attendance_summary"] = self._calculate_attendance_summary(event_record["participants"])
        return event_record

    def update_metadata(self, event_id: str, date: Optional[str] = None, venue: Optional[Dict[str, Any]] = None, metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Update top-level event date, venue, or custom metadata."""
        event = self.get_event(event_id)
        if not event:
            return None

        if date:
            event["date"] = date
        if venue:
            event["venue"] = venue
        if metadata:
            if "metadata" not in event:
                event["metadata"] = {}
            event["metadata"].update(metadata)

        if self._db:
            try:
                self._db.collection("events").document(event_id).update({
                    "date": event["date"],
                    "venue": event["venue"],
                    "metadata": event["metadata"]
                })
            except Exception:
                pass

        IN_MEMORY_FIRESTORE[event_id] = event
        event["attendance_summary"] = self._calculate_attendance_summary(event.get("participants", {}))
        return event

    def checkin_participant(self, event_id: str, ticket_ref_or_user_id: str, scanned_by: str = "staff-gate-1", notes: str = "") -> Dict[str, Any]:
        """Check in participant on event date and update show-up timestamp."""
        event = IN_MEMORY_FIRESTORE.get(event_id)
        if not event:
            raise ValueError(f"Event '{event_id}' not found.")

        participants = event.setdefault("participants", {})
        
        # Look up by user_id or ticket_ref
        target_key = None
        for k, p in participants.items():
            if k == ticket_ref_or_user_id or p.get("ticket_ref") == ticket_ref_or_user_id or p.get("user_id") == ticket_ref_or_user_id:
                target_key = k
                break

        now_iso = datetime.now(timezone.utc).isoformat()

        if target_key:
            participant = participants[target_key]
            participant["attended"] = True
            participant["checked_in_at"] = now_iso
            participant["scanned_by"] = scanned_by
            if notes:
                participant["notes"] = notes
        else:
            # Register walk-in on date
            target_key = ticket_ref_or_user_id
            participant = {
                "user_id": ticket_ref_or_user_id,
                "ticket_ref": ticket_ref_or_user_id,
                "name": f"Attendee {ticket_ref_or_user_id}",
                "email": f"{ticket_ref_or_user_id}@devfest.th",
                "role": "PARTICIPANT",
                "registered_at": now_iso,
                "attended": True,
                "checked_in_at": now_iso,
                "scanned_by": scanned_by,
                "notes": notes or "Walk-in checkin"
            }
            participants[target_key] = participant

        if self._db:
            try:
                self._db.collection("events").document(event_id).update({
                    f"participants.{target_key}": participant
                })
            except Exception:
                pass

        summary = self._calculate_attendance_summary(participants)
        return {
            "message": f"Participant '{participant['name']}' ({participant['ticket_ref']}) checked in successfully!",
            "participant": participant,
            "attendance_summary": summary
        }

    def get_attendance_summary(self, event_id: str) -> Dict[str, Any]:
        """Get live show up metrics for the event."""
        event = self.get_event(event_id)
        if not event:
            raise ValueError(f"Event '{event_id}' not found.")
        participants = event.get("participants", {})
        return self._calculate_attendance_summary(participants)

    def _calculate_attendance_summary(self, participants: Dict[str, Any]) -> Dict[str, Any]:
        total_registered = len(participants)
        total_attended = sum(1 for p in participants.values() if p.get("attended") is True)
        rate = round((total_attended / total_registered * 100), 1) if total_registered > 0 else 0.0
        
        return {
            "total_registered": total_registered,
            "total_attended": total_attended,
            "show_up_rate_percent": rate,
            "absent_count": total_registered - total_attended
        }

    def save_feedback(self, event_id: str, feedback_data: Dict[str, Any]) -> bool:
        """Save attendee feedback per event to Firestore."""
        event = self.get_event(event_id)
        if event:
            if "feedbacks" not in event:
                event["feedbacks"] = []
            event["feedbacks"].append(feedback_data)

        if self._db:
            try:
                self._db.collection("events").document(event_id).collection("feedbacks").document(feedback_data["id"]).set(feedback_data)
                return True
            except Exception:
                return False
        return True

    def list_feedback(self, event_id: str = "devfest-bangkok-2026") -> List[Dict[str, Any]]:
        """List all feedback documents for a specific event from Firestore."""
        if self._db:
            try:
                docs = self._db.collection("events").document(event_id).collection("feedbacks").stream()
                fbs = [d.to_dict() for d in docs]
                if fbs:
                    return sorted(fbs, key=lambda x: x.get("created_at", ""), reverse=True)
            except Exception:
                pass

        event = self.get_event(event_id)
        if event and "feedbacks" in event:
            return sorted(event["feedbacks"], key=lambda x: x.get("created_at", ""), reverse=True)
        return []

    def save_qna(self, event_id: str, qna_data: Dict[str, Any]) -> bool:
        """Save attendee stage Q&A question per event to Firestore."""
        event = self.get_event(event_id)
        if event:
            if "qna" not in event:
                event["qna"] = []
            event["qna"].append(qna_data)

        if self._db:
            try:
                self._db.collection("events").document(event_id).collection("qna").document(qna_data["id"]).set(qna_data)
                return True
            except Exception:
                return False
        return True

    def list_qna(self, event_id: str = "devfest-bangkok-2026") -> List[Dict[str, Any]]:
        """List all Q&A questions for a specific event from Firestore."""
        if self._db:
            try:
                docs = self._db.collection("events").document(event_id).collection("qna").stream()
                questions = [d.to_dict() for d in docs]
                if questions:
                    return sorted(questions, key=lambda x: x.get("upvotes", 0), reverse=True)
            except Exception:
                pass

        event = self.get_event(event_id)
        if event and "qna" in event:
            return sorted(event["qna"], key=lambda x: x.get("upvotes", 0), reverse=True)
        return []

    def upvote_qna(self, event_id: str, qna_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Upvote a Q&A question on Firestore for the specific event."""
        event = self.get_event(event_id)
        target_q = None
        if event and "qna" in event:
            for q in event["qna"]:
                if q.get("id") == qna_id:
                    target_q = q
                    break

        if target_q:
            if "upvoted_by" not in target_q:
                target_q["upvoted_by"] = []
            if user_id in target_q["upvoted_by"]:
                target_q["upvoted_by"].remove(user_id)
                target_q["upvotes"] = max(0, target_q.get("upvotes", 1) - 1)
            else:
                target_q["upvoted_by"].append(user_id)
                target_q["upvotes"] = target_q.get("upvotes", 0) + 1

        if self._db and target_q:
            try:
                self._db.collection("events").document(event_id).collection("qna").document(qna_id).set(target_q, merge=True)
            except Exception:
                pass
        return target_q

    def save_user_avatar(self, user_id: str, avatar_config: Dict[str, Any], event_id: str = "devfest-bangkok-2026") -> bool:
        """Save user custom pixel avatar configuration to Firestore."""
        # 1. Update in-memory users cache
        if user_id in IN_MEMORY_USERS:
            IN_MEMORY_USERS[user_id]["avatar_config"] = dict(avatar_config)

        # 2. Update event participant record
        event = self.get_event(event_id)
        if event and "participants" in event and user_id in event["participants"]:
            event["participants"][user_id]["avatar_config"] = dict(avatar_config)

        # 3. Persist to Firestore
        if self._db:
            try:
                self._db.collection(self.users_collection_name).document(user_id).set({
                    "avatar_config": avatar_config
                }, merge=True)
                self._db.collection("events").document(event_id).set({
                    "participants": {
                        user_id: {"avatar_config": avatar_config}
                    }
                }, merge=True)
                return True
            except Exception:
                return False
        return True

    def save_session(self, event_id: str, session_data: Dict[str, Any]) -> bool:
        """Save new or updated agenda session to Firestore."""
        event = self.get_event(event_id)
        if event:
            if "sessions" not in event:
                event["sessions"] = []
            # Check if exists
            idx = next((i for i, s in enumerate(event["sessions"]) if s.get("id") == session_data.get("id")), None)
            if idx is not None:
                event["sessions"][idx] = session_data
            else:
                event["sessions"].append(session_data)

        if self._db:
            try:
                self._db.collection("events").document(event_id).collection("sessions").document(session_data["id"]).set(session_data)
                return True
            except Exception:
                return False
        return True

    # --- USER MANAGEMENT & FIRESTORE INTEGRATION ---

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user document from Firestore 'users' collection."""
        if self._db:
            try:
                doc = self._db.collection(self.users_collection_name).document(user_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    IN_MEMORY_USERS[user_id] = data
                    return data
            except Exception:
                pass
        return IN_MEMORY_USERS.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Look up user by email in Firestore or in-memory store."""
        if self._db:
            try:
                docs = self._db.collection(self.users_collection_name).where("email", "==", email).limit(1).stream()
                for d in docs:
                    data = d.to_dict()
                    IN_MEMORY_USERS[data["id"]] = data
                    return data
            except Exception:
                pass
        return next((u for u in IN_MEMORY_USERS.values() if u.get("email") == email), None)

    def list_users(self, role: Optional[str] = None, search: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """List and search all users stored in Firestore with optional role filter and search query."""
        all_users = []
        if self._db:
            try:
                query = self._db.collection(self.users_collection_name)
                if role:
                    query = query.where("role", "==", role)
                docs = query.stream()
                for d in docs:
                    data = d.to_dict()
                    all_users.append(data)
                    IN_MEMORY_USERS[data["id"]] = data
            except Exception:
                all_users = []

        if not all_users:
            all_users = list(IN_MEMORY_USERS.values())

        if role:
            all_users = [u for u in all_users if u.get("role") == role]

        if search:
            s_lower = search.strip().lower()
            all_users = [
                u for u in all_users
                if s_lower in u.get("display_name", "").lower()
                or s_lower in u.get("email", "").lower()
                or s_lower in (u.get("ticket_ref") or "").lower()
                or s_lower in u.get("id", "").lower()
            ]

        total = len(all_users)
        paginated_users = all_users[offset:offset + limit]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "users": paginated_users
        }

    def upsert_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update a user document in Firestore 'users' collection with multi-event support."""
        user_id = user_data.get("id")
        if not user_id:
            raise ValueError("user_data must contain an 'id' key.")

        now_iso = datetime.now(timezone.utc).isoformat()
        existing = self.get_user(user_id) or {}
        
        events_map = user_data.get("events") or existing.get("events") or {}
        global_role = user_data.get("global_role", existing.get("global_role", "PARTICIPANT"))
        default_role = user_data.get("role", existing.get("role", global_role))

        user_record = {
            "id": user_id,
            "email": user_data.get("email", existing.get("email", f"{user_id}@devfestverse.io")),
            "display_name": user_data.get("display_name", existing.get("display_name", "DevFest Attendee")),
            "global_role": global_role,
            "role": default_role,
            "verified_ticket": user_data.get("verified_ticket", existing.get("verified_ticket", False)),
            "ticket_ref": user_data.get("ticket_ref", existing.get("ticket_ref", None)),
            "events": events_map,
            "favorite_sessions": user_data.get("favorite_sessions", existing.get("favorite_sessions", [])),
            "avatar_url": user_data.get("avatar_url", existing.get("avatar_url", None)),
            "avatar_config": user_data.get("avatar_config", existing.get("avatar_config", None)),
            "avatar_svg": user_data.get("avatar_svg", existing.get("avatar_svg", None)),
            "auth_provider": user_data.get("auth_provider", existing.get("auth_provider", "local")),
            "google_sub": user_data.get("google_sub", existing.get("google_sub", None)),
            "created_at": existing.get("created_at", now_iso),
            "updated_at": now_iso,
            "is_active": user_data.get("is_active", existing.get("is_active", True))
        }

        if self._db:
            try:
                self._db.collection(self.users_collection_name).document(user_id).set(user_record, merge=True)
            except Exception:
                pass

        IN_MEMORY_USERS[user_id] = user_record
        return user_record

    def get_user_role_in_event(self, user_id: str, event_id: str = "devfest-bangkok-2026") -> Dict[str, Any]:
        """Resolve effective role, ticket, and check-in status for a specific event."""
        user = self.get_user(user_id)
        if not user:
            return {
                "event_id": event_id,
                "role": "PARTICIPANT",
                "ticket_ref": None,
                "verified_ticket": False,
                "attended": False
            }

        # Global organizer override
        if user.get("global_role") == "ORGANIZER":
            event_entry = user.get("events", {}).get(event_id, {})
            return {
                "event_id": event_id,
                "role": "ORGANIZER",
                "ticket_ref": event_entry.get("ticket_ref", user.get("ticket_ref")),
                "verified_ticket": True,
                "attended": event_entry.get("attended", False)
            }

        # Check event membership
        events_map = user.get("events", {})
        if event_id in events_map:
            entry = events_map[event_id]
            return {
                "event_id": event_id,
                "role": entry.get("role", "PARTICIPANT"),
                "ticket_ref": entry.get("ticket_ref"),
                "verified_ticket": entry.get("verified_ticket", False),
                "attended": entry.get("attended", False),
                "registered_at": entry.get("registered_at")
            }

        # Fallback to user base record
        return {
            "event_id": event_id,
            "role": user.get("role", "PARTICIPANT"),
            "ticket_ref": user.get("ticket_ref"),
            "verified_ticket": user.get("verified_ticket", False),
            "attended": False
        }

    def set_user_event_role(
        self,
        user_id: str,
        event_id: str,
        role: str,
        ticket_ref: Optional[str] = None,
        verified: Optional[bool] = None
    ) -> Optional[Dict[str, Any]]:
        """Assign or update a user's role and ticket within a specific event on Firestore."""
        user = self.get_user(user_id)
        if not user:
            return None

        if "events" not in user or not isinstance(user["events"], dict):
            user["events"] = {}

        now_iso = datetime.now(timezone.utc).isoformat()
        current_event_data = user["events"].get(event_id, {})

        new_event_data = {
            "role": role,
            "ticket_ref": ticket_ref if ticket_ref is not None else current_event_data.get("ticket_ref", user.get("ticket_ref")),
            "verified_ticket": verified if verified is not None else current_event_data.get("verified_ticket", user.get("verified_ticket", False)),
            "attended": current_event_data.get("attended", False),
            "registered_at": current_event_data.get("registered_at", now_iso),
            "updated_at": now_iso
        }
        user["events"][event_id] = new_event_data
        user["updated_at"] = now_iso

        # If this is the primary event, keep top-level fields in sync for backward compatibility
        if event_id == "devfest-bangkok-2026":
            user["role"] = role
            if ticket_ref is not None:
                user["ticket_ref"] = ticket_ref
            if verified is not None:
                user["verified_ticket"] = verified

        # Sync Firestore doc
        if self._db:
            try:
                self._db.collection(self.users_collection_name).document(user_id).set({
                    "events": user["events"],
                    "role": user["role"],
                    "updated_at": user["updated_at"]
                }, merge=True)
            except Exception:
                pass

        IN_MEMORY_USERS[user_id] = user

        # Sync to Event document participants map in Firestore
        event = IN_MEMORY_FIRESTORE.get(event_id)
        if event:
            participants = event.setdefault("participants", {})
            participants[user_id] = {
                "user_id": user_id,
                "ticket_ref": new_event_data["ticket_ref"],
                "name": user.get("display_name", "Attendee"),
                "email": user.get("email", ""),
                "role": role,
                "registered_at": new_event_data["registered_at"],
                "attended": new_event_data["attended"]
            }
            if self._db:
                try:
                    self._db.collection(self.events_collection_name).document(event_id).update({
                        f"participants.{user_id}": participants[user_id]
                    })
                except Exception:
                    pass

        return user

    def list_user_events(self, user_id: str) -> List[Dict[str, Any]]:
        """List all events a user is participating in, with their respective roles."""
        user = self.get_user(user_id)
        if not user:
            return []

        events_map = user.get("events", {})
        results = []
        for e_id, membership in events_map.items():
            ev = self.get_event(e_id)
            event_name = ev.get("event_name", e_id) if ev else e_id
            date = ev.get("date") if ev else None
            results.append({
                "event_id": e_id,
                "event_name": event_name,
                "date": date,
                "role": membership.get("role", "PARTICIPANT"),
                "ticket_ref": membership.get("ticket_ref"),
                "verified_ticket": membership.get("verified_ticket", False),
                "attended": membership.get("attended", False),
                "registered_at": membership.get("registered_at")
            })
        return results

    def list_event_users(
        self,
        event_id: str,
        role: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """List all users participating in a specific event."""
        all_users = list(IN_MEMORY_USERS.values())
        if self._db:
            try:
                docs = self._db.collection(self.users_collection_name).stream()
                db_users = [d.to_dict() for d in docs]
                if db_users:
                    all_users = db_users
            except Exception:
                pass

        event_users = []
        for u in all_users:
            events_map = u.get("events", {})
            # Match membership or global organizer
            if event_id in events_map or u.get("global_role") == "ORGANIZER":
                membership = events_map.get(event_id, {})
                effective_role = "ORGANIZER" if u.get("global_role") == "ORGANIZER" else membership.get("role", u.get("role", "PARTICIPANT"))
                if role and effective_role != role:
                    continue
                
                u_copy = dict(u)
                u_copy["event_id"] = event_id
                u_copy["effective_role"] = effective_role
                u_copy["event_ticket_ref"] = membership.get("ticket_ref", u.get("ticket_ref"))
                u_copy["event_verified_ticket"] = membership.get("verified_ticket", u.get("verified_ticket", False))
                event_users.append(u_copy)

        if search:
            s_lower = search.strip().lower()
            event_users = [
                u for u in event_users
                if s_lower in u.get("display_name", "").lower()
                or s_lower in u.get("email", "").lower()
                or s_lower in (u.get("event_ticket_ref") or "").lower()
                or s_lower in u.get("id", "").lower()
            ]

        total = len(event_users)
        return {
            "event_id": event_id,
            "total": total,
            "limit": limit,
            "offset": offset,
            "users": event_users[offset:offset + limit]
        }

    def update_user_role(self, user_id: str, new_role: str, event_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Update role for a user in Firestore (supports event-scoped updates)."""
        target_event = event_id or "devfest-bangkok-2026"
        return self.set_user_event_role(user_id=user_id, event_id=target_event, role=new_role)

    def update_user_ticket(self, user_id: str, ticket_ref: str, verified: bool = True, event_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Assign or verify ticket reference for a user in Firestore."""
        target_event = event_id or "devfest-bangkok-2026"
        user = self.get_user(user_id)
        if not user:
            return None
        current_role = user.get("events", {}).get(target_event, {}).get("role", user.get("role", "PARTICIPANT"))
        return self.set_user_event_role(user_id=user_id, event_id=target_event, role=current_role, ticket_ref=ticket_ref, verified=verified)

    def delete_user(self, user_id: str) -> bool:
        """Delete user document from Firestore and local cache."""
        existed = user_id in IN_MEMORY_USERS
        if existed:
            del IN_MEMORY_USERS[user_id]

        if self._db:
            try:
                self._db.collection(self.users_collection_name).document(user_id).delete()
                return True
            except Exception:
                pass
        return existed or True

    def get_user_stats(self, event_id: Optional[str] = None) -> Dict[str, Any]:
        """Compute aggregated live user metrics across Firestore for all events or a specific event."""
        users = list(IN_MEMORY_USERS.values())
        if self._db:
            try:
                docs = self._db.collection(self.users_collection_name).stream()
                db_users = [d.to_dict() for d in docs]
                if db_users:
                    users = db_users
            except Exception:
                pass

        target_event = event_id or "devfest-bangkok-2026"
        
        # Calculate event-specific or global stats
        total_users = len(users)
        organizers = 0
        staff = 0
        speakers = 0
        sponsors = 0
        participants = 0
        verified_tickets = 0

        for u in users:
            eff = self.get_user_role_in_event(u["id"], target_event)
            r = eff.get("role")
            if r == "ORGANIZER": organizers += 1
            elif r == "STAFF": staff += 1
            elif r == "SPEAKER": speakers += 1
            elif r == "SPONSOR": sponsors += 1
            else: participants += 1

            if eff.get("verified_ticket"):
                verified_tickets += 1

        google_users = sum(1 for u in users if u.get("auth_provider") == "google" or "gmail.com" in u.get("email", ""))

        return {
            "event_id": target_event,
            "total_users": total_users,
            "by_role": {
                "ORGANIZER": organizers,
                "STAFF": staff,
                "SPEAKER": speakers,
                "SPONSOR": sponsors,
                "PARTICIPANT": participants
            },
            "verified_tickets_count": verified_tickets,
            "google_authenticated_count": google_users,
            "project_id": self.project_id
        }

firestore_manager = FirestoreEventManager()


