from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    knowledge_index_path: str = "data/knowledge_index.json"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def resolved_index_path(self) -> Path:
        path = Path(self.knowledge_index_path)
        return path if path.is_absolute() else Path(__file__).resolve().parents[1] / path

@lru_cache
def get_settings() -> Settings:
    return Settings()
