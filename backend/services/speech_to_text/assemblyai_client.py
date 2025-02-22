import assemblyai as aai
from typing import Callable, Optional
from .config import config

class AssemblyAIClient:
    def __init__(self):
        aai.settings.api_key = config.API_KEY
        # Transcriber is an object that has the callback functions to handle different events
        self.transcriber = None
  
    def create_transcriber(
        self,
        on_data: Callable[[aai.RealtimeTranscript], None],
        on_error: Optional[Callable[[aai.RealtimeError], None]] = None,
        on_open: Optional[Callable[[aai.RealtimeSessionOpened], None]] = None,
        on_close: Optional[Callable[[], None]] = None
    ):
        """Create a new real-time transcriber instance"""
        self.transcriber = aai.RealtimeTranscriber(
            sample_rate=config.SAMPLE_RATE,
            on_data=on_data,
            on_error=on_error or self._default_on_error,
            on_open=on_open or self._default_on_open,
            on_close=on_close or self._default_on_close
        )
        return self.transcriber

    def _default_on_open(self, session_opened: aai.RealtimeSessionOpened):
        """Default handler for connection opening"""
        print("Session ID:", session_opened.session_id)

    def _default_on_error(self, error: aai.RealtimeError):
        """Default handler for errors"""
        print("An error occurred:", error)

    def _default_on_close(self):
        """Default handler for connection closing"""
        print("Closing Session")

    async def start_streaming(self):
        """Start the transcription stream"""
        if not self.transcriber:
            raise ValueError("Transcriber not initialized. Call create_transcriber first.")
        
        self.transcriber.connect()
        microphone_stream = aai.extras.MicrophoneStream(sample_rate=config.SAMPLE_RATE)
        try:
            self.transcriber.stream(microphone_stream)
        finally:
            self.close()
        
    def close(self):
        """Close the transcriber"""
        if self.transcriber:
            self.transcriber.close()
            self.transcriber = None

    async def stop_streaming(self):
        """Stop the transcription stream"""
        

