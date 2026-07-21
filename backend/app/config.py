from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    ENV: str = "development"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.4"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    MAX_UPLOAD_MB: int = 50
    UPLOAD_DIR: str = "/tmp/harmonia_uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
