from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "DevFestVerse"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "devfestverse-super-secret-key-gdg-cloud-bangkok"
    
    # Official DevFest Ticket Config
    DEFAULT_TICKET_REGISTRATION_URL: str = "https://gdg.community.dev/events/details/google-gdg-cloud-bangkok-presents-devfest-bangkok/"
    
    class Config:
        case_sensitive = True

settings = Settings()
