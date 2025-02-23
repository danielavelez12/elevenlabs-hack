import asyncio
import base64
import json
from shared_state import connected_clients


class AudioInputHandler:
    def __init__(self):
        self.buffer = bytearray()
        self.read_offset = 0

    def write_audio(self, data):
        self.buffer.extend(data)

    async def notify_websocket(self, user_id):
        print("[notify_websocket], user_id: ", user_id)
        if user_id in connected_clients:
            print("sending to ", connected_clients[user_id])
            await connected_clients[user_id].send_text(
                json.dumps({"type": "new_audio", "length": len(self.buffer)})
            )
