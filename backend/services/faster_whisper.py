import os
import numpy as np
from faster_whisper import WhisperModel
from typing import Optional, Callable


class FasterWhisperClient:
    def __init__(
        self,
        language: str = "en",
        sample_rate: int = 16000,
        on_transcript: Optional[Callable[[str], None]] = None,
    ):
        self.language = language
        self.sample_rate = sample_rate
        self.on_transcript = on_transcript

        # Initialize Whisper model with CPU settings
        self.model = WhisperModel(
            model_size_or_path="large-v3",
            device="cpu",
            compute_type="int8",
            download_root=os.path.join(os.path.expanduser("~"), ".cache", "whisper"),
        )

    async def transcribe_audio_stream(self, audio_processor):
        try:
            # Accumulate audio data
            audio_data = bytearray()
            chunk_size = 1024 * 16  # 16KB chunks

            while True:
                chunk = await audio_processor.read(chunk_size)
                if not chunk:
                    break

                audio_data.extend(chunk)

                # Only process if we have enough data
                if len(audio_data) >= chunk_size:
                    # Convert to numpy array for processing
                    audio_array = np.frombuffer(audio_data, dtype=np.float32)

                    # Process with Whisper
                    segments, info = self.model.transcribe(
                        audio_array, language=self.language, word_timestamps=True
                    )

                    # Handle transcripts
                    for segment in segments:
                        if self.on_transcript:
                            self.on_transcript(segment.text)

                    # Clear processed audio
                    audio_data = bytearray()

        except Exception as e:
            print(f"Error during transcription: {str(e)}")
            raise
