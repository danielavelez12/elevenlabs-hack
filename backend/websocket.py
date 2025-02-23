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
    server = await websockets.serve(audio_broadcast_handler, "localhost", 8765)
    print("WebSocket server started on ws://localhost:8765")
    return server


async def broadcast_audio_stream(audio_stream):
    print("Broadcasting audio stream")
    print(connected_clients)
    async for chunk in audio_stream:
        print("Chunk received")
        if chunk and connected_clients:
            print("Broadcasting audio chunk")
            # Convert bytes to base64 to ensure safe transmission
            chunk_base64 = base64.b64encode(chunk).decode("utf-8")
            # Send as a WebSocket text message
            await asyncio.gather(
                *(
                    client.send_text(
                        json.dumps({"type": "audio_chunk", "data": chunk_base64})
                    )
                    for client in connected_clients.values()
                )
            )

    if connected_clients:
        # Send end of stream message as text
        await asyncio.gather(
            *(
                client.send_text(json.dumps({"type": "end_of_stream"}))
                for client in connected_clients.values()
            )
        )
