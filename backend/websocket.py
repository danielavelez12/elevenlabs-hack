import asyncio
import websockets
import json

# Global set of connected clients
connected_clients = set()


async def audio_broadcast_handler(websocket, path=None):
    # Register new client
    connected_clients.add(websocket)
    print("New client connected")
    try:
        # Keep the connection open.
        await websocket.wait_closed()
    finally:
        # Remove client when connection closes.
        connected_clients.remove(websocket)
        print("Client disconnected")


async def start_websocket_server():
    server = await websockets.serve(audio_broadcast_handler, "localhost", 8765)
    print("WebSocket server started on ws://localhost:8765")
    return server


async def broadcast_audio_stream(audio_stream):
    async for chunk in audio_stream:
        if chunk:
            if connected_clients:
                await asyncio.gather(
                    *(client.send(chunk) for client in connected_clients)
                )
    if connected_clients:
        end_message = json.dumps({"end_of_stream": True})
        await asyncio.gather(
            *(client.send(end_message) for client in connected_clients)
        )
