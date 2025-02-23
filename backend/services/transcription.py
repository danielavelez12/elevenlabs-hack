from multiprocessing import Process, Queue

from services.audio_input_handler import AudioInputHandler
from services.speech_to_text.speechmatics_client import SpeechmaticsClient
from shared_state import ongoing_calls
import os


def transcribe_audio(audio_queue: Queue, speechmatics_client: SpeechmaticsClient):
    while True:
        # Wait for new audio data
        data = audio_queue.get()
        if data is None:
            break  # Exit the loop if None is received

        # Transcribe the audio data
        transcript = speechmatics_client.transcribe_audio(data)
        print(f"Transcription: {transcript}")