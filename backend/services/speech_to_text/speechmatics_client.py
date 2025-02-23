import asyncio
import speechmatics
from typing import AsyncGenerator, Callable, Optional
from speechmatics.models import ServerMessageType, TranscriptionConfig, ConnectionSettings, AudioSettings

class SpeechmaticsClient:
    def __init__(
        self,
        api_key: str,
        language: str = "en",
        sample_rate: int = 16000,
        connection_url: str = "wss://eu2.rt.speechmatics.com/v2",
        on_transcript: Optional[Callable[[str], None]] = None
    ):
        self.api_key = api_key
        self.language = language
        self.connection_url = connection_url
        self.sample_rate = sample_rate
        self.on_transcript = on_transcript

        self.ws_client = speechmatics.client.WebsocketClient(
            ConnectionSettings(
                url=connection_url,
                auth_token=api_key,
            )
        )

        self.ws_client.add_event_handler(
            event_name=ServerMessageType.AddTranscript,
            event_handler=self._sync_handle_transcript
        )

    def _sync_handle_transcript(self, msg):
        transcript = msg['metadata']['transcript']
        if self.on_transcript:
            self.on_transcript(transcript)

    async def transcribe_audio_stream(self, audio_processor) -> AsyncGenerator[str, None]:
        config = TranscriptionConfig(
            language=self.language,
            max_delay=2,
            
        )
        
        settings = AudioSettings()
        settings.encoding = "pcm_f32le"  # 32-bit float PCM
        settings.sample_rate = self.sample_rate
        settings.chunk_size = 1024

        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                self.ws_client.run_synchronously,
                audio_processor,
                config,
                settings
            )
        except Exception as e:
            print(f"Error during transcription: {str(e)}")
            raise