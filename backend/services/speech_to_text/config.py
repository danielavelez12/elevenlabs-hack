from pydantic_settings import BaseSettings
from pydantic.fields import Field

class AssemblyAIConfig(BaseSettings):
    API_KEY: str = Field(..., env="ASSEMBLYAI_API_KEY")
    SAMPLE_RATE: int = 44_100

    class Config:
        env_prefix = "ASSEMBLYAI_"

config = AssemblyAIConfig()