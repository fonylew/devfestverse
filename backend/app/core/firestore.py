import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

try:
    from google.cloud import firestore
    HAS_FIRESTORE_LIB = True
except ImportError:
    HAS_FIRESTORE_LIB = False

# Fallback in-memory Firestore database for local execution & unit testing
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
    }
}

class FirestoreEventManager:
    def __init__(self, project_id: Optional[str] = None):
        self.project_id = project_id or os.getenv("GCP_PROJECT", "gdg-cloud-bangkok-2026")
        self._db = None
        
        # Initialize Google Cloud Firestore client if running with GCP ADC
        if HAS_FIRESTORE_LIB and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
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
        """Save attendee feedback to Firestore."""
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

    def save_user_avatar(self, user_id: str, avatar_config: Dict[str, Any], event_id: str = "devfest-bangkok-2026") -> bool:
        """Save user custom pixel avatar configuration to Firestore."""
        event = self.get_event(event_id)
        if event and "participants" in event and user_id in event["participants"]:
            event["participants"][user_id]["avatar_config"] = avatar_config

        if self._db:
            try:
                self._db.collection("users").document(user_id).set({"avatar_config": avatar_config}, merge=True)
                self._db.collection("events").document(event_id).update({
                    f"participants.{user_id}.avatar_config": avatar_config
                })
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

firestore_manager = FirestoreEventManager()
