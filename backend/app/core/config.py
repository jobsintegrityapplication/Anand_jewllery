from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"
    JWT_SECRET_KEY: str
    JWT_EXPIRE_MINUTES: int = 720
    CORS_ORIGINS: str = "http://localhost"
    APP_PUBLIC_URL: str = "http://localhost"
    S3_ENDPOINT_URL: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET: str = "anand-jewellers"
    S3_REGION: str = "us-east-1"
    WHATSAPP_ENABLED: bool = False
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_GRAPH_VERSION: str = "v23.0"
    WHATSAPP_READY_TEMPLATE_NAME: str = "item_ready"
    WHATSAPP_TEMPLATE_LANGUAGE: str = "en"
    WHATSAPP_TEMPLATE_ORDER_CREATED: str = ""
    WHATSAPP_TEMPLATE_ORDER_IN_PROGRESS: str = ""
    WHATSAPP_TEMPLATE_ORDER_READY: str = ""
    WHATSAPP_TEMPLATE_ORDER_DELIVERED: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
settings = Settings()
