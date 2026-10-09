import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "DevFestVerse"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-insecure-secret-key-change-in-production")
    
    # GCP & Google Cloud Firestore Configuration
    GCP_PROJECT: str = os.getenv("GCP_PROJECT", os.getenv("GOOGLE_CLOUD_PROJECT", ""))
    
    # Admin Email Configuration (loaded from env)
    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "")
    
    # Google Identity Services (GIS) / Google Auth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    
    FIRESTORE_USERS_COLLECTION: str = "users"
    FIRESTORE_EVENTS_COLLECTION: str = "events"

    # Official DevFest Ticket Config
    DEFAULT_TICKET_REGISTRATION_URL: str = "https://gdg.community.dev/"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

settings = Settings()
