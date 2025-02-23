import asyncio
import websockets
import json
import urllib.parse
import base64

# Import the shared state from a new module
from shared_state import connected_clients


async def audio_broadcast_handler(websocket, path=None):
    # Extract user_id from query parameters using the path argument
    query = urllib.parse.parse_qs(urllib.parse.urlparse(path).query)
    user_id = query.get("user_id", [None])[0]

    if not user_id:
        await websocket.close(1008, "Missing user ID")
        return

    # Register client with their user ID
    connected_clients[user_id] = websocket
    print(f"New client connected: {user_id}")

    try:
        await websocket.wait_closed()
    finally:
        if user_id in connected_clients:
            del connected_clients[user_id]
        print(f"Client disconnected: {user_id}")


async def start_websocket_server():
    server = await websockets.serve(audio_broadcast_handler, "0.0.0.0", 8765)
    print("WebSocket server started on ws://0.0.0.0:8765")
    return server


async def broadcast_audio_stream(audio_stream, recipient_id):
    print(f"Broadcasting audio stream to recipient: {recipient_id}")
    print(connected_clients)
    async for chunk in audio_stream:
        print("Chunk received")
        if chunk and recipient_id in connected_clients:
            print(f"Sending audio chunk to recipient: {recipient_id}")
            # Convert bytes to base64 to ensure safe transmission
            chunk_base64 = base64.b64encode(chunk).decode("utf-8")
            # Send only to the intended recipient
            await connected_clients[recipient_id].send_text(
                json.dumps({"type": "audio_chunk", "data": chunk_base64})
            )

    if recipient_id in connected_clients:
        # Send end of stream message as text
        await connected_clients[recipient_id].send_text(
            json.dumps({"type": "end_of_stream"})
        )
