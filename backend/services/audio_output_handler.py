import asyncio
import base64
import json
from shared_state import connected_clients


class AudioOutputHandler:
    def __init__(self, buffer):
        self.buffer = buffer
        self.read_offset = 0

    async def read_and_send(self, recipient_id):
        print("[read_and_send], recipient_id: ", recipient_id)
        while self.read_offset < len(self.buffer):
            chunk_size = 1024  # Define your chunk size
            new_offset = min(self.read_offset + chunk_size, len(self.buffer))
            chunk = self.buffer[self.read_offset : new_offset]
            self.read_offset = new_offset

            if recipient_id in connected_clients:
                chunk_base64 = base64.b64encode(chunk).decode("utf-8")
                await connected_clients[recipient_id].send_text(
                    json.dumps({"type": "audio_chunk", "data": chunk_base64})
                )

        if recipient_id in connected_clients:
            await connected_clients[recipient_id].send_text(
                json.dumps({"type": "end_of_stream"})
            )
