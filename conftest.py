import sys
from pathlib import Path

# Add project root directory to sys.path
root_dir = Path(__file__).parent.resolve()
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.core.firestore import firestore_manager
from backend.app.core.config import settings

# Seed test users for pytest suite execution
firestore_manager.upsert_user({
    "id": "user-org-1",
    "email": settings.DEFAULT_ADMIN_EMAIL or "admin@example.com",
    "display_name": "Test Organizer",
    "global_role": "ORGANIZER",
    "role": "ORGANIZER",
    "verified_ticket": True,
    "ticket_ref": "TICKET-DEV-001",
    "events": {
        "devfest-bangkok-2026": {
            "role": "ORGANIZER",
            "ticket_ref": "TICKET-DEV-001",
            "verified_ticket": True,
            "attended": True
        },
        "gdg-ai-hackathon-2026": {
            "role": "ORGANIZER",
            "ticket_ref": "TICKET-HACK-001",
            "verified_ticket": True,
            "attended": False
        }
    }
})

firestore_manager.upsert_user({
    "id": "user-staff-1",
    "email": "staff@example.com",
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
            "attended": True
        }
    }
})

firestore_manager.upsert_user({
    "id": "user-speaker-1",
    "email": "speaker@example.com",
    "display_name": "Speaker Agent",
    "global_role": "PARTICIPANT",
    "role": "SPEAKER",
    "verified_ticket": True,
    "ticket_ref": "TICKET-DEV-003",
    "events": {
        "devfest-bangkok-2026": {
            "role": "SPEAKER",
            "ticket_ref": "TICKET-DEV-003",
            "verified_ticket": True,
            "attended": True
        }
    }
})

firestore_manager.upsert_user({
    "id": "user-sponsor-1",
    "email": "sponsor@example.com",
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
            "attended": True
        }
    }
})

firestore_manager.upsert_user({
    "id": "user-partic-1",
    "email": "partic@example.com",
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
            "attended": False
        },
        "gdg-ai-hackathon-2026": {
            "role": "SPEAKER",
            "ticket_ref": "TICKET-HACK-DEV",
            "verified_ticket": True,
            "attended": False
        }
    }
})

firestore_manager.upsert_user({
    "id": "user-partic-2",
    "email": "sara@example.com",
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
            "attended": True
        }
    }
})
