import asyncio
import speechmatics
from typing import AsyncGenerator, Callable, Optional
from speechmatics.models import (
    ServerMessageType,
    TranscriptionConfig,
    ConnectionSettings,
    AudioSettings,
)


class SpeechmaticsClient:
    def __init__(
        self,
        api_key: str,
        language: str = "en",
        sample_rate: int = 16000,
        connection_url: str = "wss://eu2.rt.speechmatics.com/v2",
        on_transcript: Optional[Callable[[str], None]] = None,
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

        # Create an asyncio.Queue to safely pass transcripts from the callback
        self.transcript_queue = asyncio.Queue()

        # Register our callback for transcript messages.
        self.ws_client.add_event_handler(
            event_name=ServerMessageType.AddTranscript,
            event_handler=self._handle_transcript,
        )

    def _handle_transcript(self, msg):
        transcript = msg["metadata"]["transcript"]
        # If an external callback is provided, call it (this runs in the worker thread)
        if self.on_transcript:
            self.on_transcript(transcript)
        # Safely schedule adding the transcript to the queue from this thread.
        asyncio.run_coroutine_threadsafe(
            self.transcript_queue.put(transcript), asyncio.get_running_loop()
        )

    async def transcribe_audio_stream(
        self, audio_processor
    ) -> AsyncGenerator[str, None]:
        config = TranscriptionConfig(language=self.language, max_delay=2)
        settings = AudioSettings(
            encoding="pcm_f32le",
            sample_rate=self.sample_rate,
            chunk_size=1024,
        )

        # Run the blocking transcription client in a separate thread.
        loop = asyncio.get_running_loop()
        transcription_future = loop.run_in_executor(
            None, self.ws_client.run_synchronously, audio_processor, config, settings
        )

        try:
            # Yield transcript chunks as they arrive.
            while True:
                transcript = await self.transcript_queue.get()
                yield transcript
        finally:
            # Wait for the transcription thread to finish if needed.
            await transcription_future
