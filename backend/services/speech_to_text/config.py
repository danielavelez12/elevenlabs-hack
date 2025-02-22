from pydantic_settings import BaseSettings
from pydantic.fields import Field

class SpeechmaticsConfig(BaseSettings):
    API_KEY: str = Field(..., env="SPEECHMATICS_API_KEY")

    class Config:
        env_prefix = "SPEECHMATICS_"

config = SpeechmaticsConfig()