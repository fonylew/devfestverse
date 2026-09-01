import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "DevFestVerse"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "dev-insecure-secret-key-change-in-production"
    
    # GCP & Google Cloud Firestore Configuration
    GCP_PROJECT: str = os.getenv("GCP_PROJECT", os.getenv("GOOGLE_CLOUD_PROJECT", ""))
    
    # Google Identity Services (GIS) / Google Auth
    GOOGLE_CLIENT_ID: str = ""
    
    FIRESTORE_USERS_COLLECTION: str = "users"
    FIRESTORE_EVENTS_COLLECTION: str = "events"

    # Official DevFest Ticket Config
    DEFAULT_TICKET_REGISTRATION_URL: str = "https://gdg.community.dev/"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

settings = Settings()
