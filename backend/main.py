from text_translate import translate_text, translate_text_stream, start_websocket_server
from fastapi import FastAPI, WebSocket, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.speech_to_text.speechmatics_client import SpeechmaticsClient
from sqlalchemy import create_engine, text
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import numpy as np
import aiohttp
import asyncio
import os
import io
import websockets
from shared_state import connected_clients, ongoing_calls
import base64
import json

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global websocket_server
    websocket_server = await start_websocket_server()

    yield

    # Shutdown
    if websocket_server:
        websocket_server.close()
        await websocket_server.wait_closed()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Development frontend
        "https://elevenlabs-hack-seven.vercel.app",  # Vercel deployment
        "*",  # Fallback - consider removing in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Add websocket-specific CORS handling
@app.middleware("http")
async def add_websocket_cors_headers(request, call_next):
    response = await call_next(request)
    if request.headers.get("upgrade", "").lower() == "websocket":
        response.headers.update(
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
            }
        )
    return response


load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Database setup
DB_URL = os.getenv("DB_URL")
engine = create_engine(DB_URL)

# Global variable for websocket server
websocket_server = None


class AudioProcessor:
    def __init__(self):
        self.wave_data = bytearray()
        self.read_offset = 0

    async def read(self, chunk_size):
        while self.read_offset + chunk_size > len(self.wave_data):
            await asyncio.sleep(0.001)
        new_offset = self.read_offset + chunk_size
        data = self.wave_data[self.read_offset : new_offset]
        self.read_offset = new_offset
        return data

    def clear_buffer(self):
        self.wave_data = bytearray()
        self.read_offset = 0

    def write_audio(self, data):
        try:
            # Data is already in float32 PCM format, just extend the buffer
            self.wave_data.extend(data)
        except Exception as e:
            print(f"Error handling audio data: {str(e)}")
            import traceback

            print(traceback.format_exc())
        return


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Extract query parameters
    query_params = dict(websocket.query_params)
    user_id = query_params.get("user_id")
    voice_id = None
    source_language_code = None
    target_language_code = None
    try:
        with engine.connect() as conn:
            query = text(
                """
                SELECT external_id
                FROM voices
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT 1
            """
            )
            result = conn.execute(query, {"user_id": user_id})
            voice_record = result.fetchone()
            if voice_record:
                voice_id = voice_record.external_id

            query = text(
                """
                SELECT language_code
                FROM users
                WHERE id = :user_id
            """
            )
            result = conn.execute(query, {"user_id": user_id})
            source_language_code = result.fetchone().language_code
    except Exception as e:
        print(f"Error fetching voice ID: {e}")

    print(f"User ID: {user_id}")
    print(f"Language code: {source_language_code}")

    buffer = []
    await websocket.accept()

    audio_processor = AudioProcessor()
    transcription_task = None  # Initialize as None

    def handle_transcript(text):
        print(f"Received transcript: {text}")
        print(f"Language code: {source_language_code}")
        buffer.append(text)
        print(f"Buffer: {buffer}")

    client = SpeechmaticsClient(
        api_key=os.getenv("SPEECHMATICS_API_KEY"),
        language=source_language_code,
        sample_rate=16000,
        on_transcript=handle_transcript,
    )

    try:
        print("Starting transcription process")
        
        # Start initial transcription task
        transcription_task = asyncio.create_task(
            client.transcribe_audio_stream(audio_processor)
        )

        print("ongoing calls: ", ongoing_calls)

        id_1, id_2 = next(
            (
                call
                for call in ongoing_calls
                if call[0] == user_id or call[1] == user_id
            ),
            None,
        )
        recipient_id = id_1 if id_1 != user_id else id_2
        print("recipient id: ", recipient_id)
        try:
            with engine.connect() as conn:
                query = text(
                    """
                    SELECT language_code
                    FROM users
                    WHERE id = :recipient_id
                """
                )
                result = conn.execute(query, {"recipient_id": recipient_id})
                print("language code query result", result)
                target_language_code = result.fetchone().language_code
        except Exception as e:
            print(f"Error fetching voice ID: {e}")

        while True:
            try:
                message = await websocket.receive_text()
                message_data = json.loads(message)
                audio_base64 = message_data.get("audio", "")
                data = base64.b64decode(audio_base64)
                terminal = message_data.get("terminal", False)

                if terminal:
                    print(f"Terminal chunk received: {buffer}")
                    # Cancel existing transcription task
                    if transcription_task:
                        transcription_task.cancel()
                        try:
                            await transcription_task
                        except asyncio.CancelledError:
                            print("Transcription task cancelled")
                    
                    await translate_text_stream(
                        " ".join(buffer),
                        source_language_code,
                        target_language_code,
                        broadcast=True,
                        voice_id=voice_id,
                    )
                    buffer = []
                    audio_processor.clear_buffer()
                    
                    # Start new transcription task
                    transcription_task = asyncio.create_task(
                        client.transcribe_audio_stream(audio_processor)
                    )
                else:
                    audio_processor.write_audio(data)
            except Exception as ws_error:
                print(f"WebSocket error: {ws_error}")
                break

    except Exception as e:
        print(f"Error in main loop: {e}")
    finally:
        if "transcription_task" in locals():
            transcription_task.cancel()
            try:
                await transcription_task
            except asyncio.CancelledError:
                print("Transcription task cancelled")
        print("WebSocket connection closed")


@app.websocket("/ws/start")
async def start_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Extract user_id from query parameters
    query_params = dict(websocket.query_params)
    user_id = query_params.get("user_id")

    if not user_id:
        await websocket.close(code=4000, reason="Missing user ID")
        return

    try:
        # Add this client to connected clients
        connected_clients[user_id] = websocket
        print(f"User {user_id} connected to call websocket")
        print("connected clients: ", connected_clients)

        # Keep connection alive and handle incoming messages
        while True:
            try:
                message = await websocket.receive_text()
                data = json.loads(message)

                if data.get("type") == "call_request":
                    recipient_id = data.get("recipient_id")
                    if recipient_id in connected_clients:
                        # Forward call request to recipient
                        await connected_clients[recipient_id].send_json(
                            {"type": "incoming_call", "caller_id": user_id}
                        )

                elif data.get("type") == "call_accepted":
                    caller_id = data.get("caller_id")
                    if caller_id in connected_clients:
                        # Notify caller that call was accepted
                        await connected_clients[caller_id].send_json(
                            {"type": "call_accepted", "recipient_id": user_id}
                        )
                elif data.get("type") == "call_ended":
                    caller_id = data.get("caller_id")
                    if caller_id in connected_clients:
                        # Notify caller that call was accepted
                        await connected_clients[caller_id].send_json(
                            {"type": "call_ended"}
                        )
                    recipient_id = data.get("recipient_id")
                    if recipient_id in connected_clients:
                        # Notify recipient that call was ended
                        await connected_clients[recipient_id].send_json(
                            {"type": "call_ended"}
                        )

            except websockets.exceptions.ConnectionClosed:
                break

    except Exception as e:
        print(f"Error in call websocket: {e}")
    finally:
        if user_id in connected_clients:
            del connected_clients[user_id]
        print(f"User {user_id} disconnected from call websocket")


@app.get("/")
async def root():
    return {"message": "Audio processing server is running"}


@app.post("/create-voice")
async def create_voice(
    user_id: str = Form(...),
    voice_name: str = Form(...),
    audio_file: UploadFile = File(...),
):
    print(voice_name, audio_file)
    try:
        content = await audio_file.read()

        # Prepare the form data for ElevenLabs API
        form_data = aiohttp.FormData()
        form_data.add_field("name", voice_name)
        form_data.add_field(
            "files",
            content,
            filename="recording.webm",
            content_type=audio_file.content_type,
        )

        # Make request to ElevenLabs API
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers={"xi-api-key": ELEVENLABS_API_KEY},
                data=form_data,
            ) as response:
                if response.status != 200:
                    error_detail = await response.text()
                    return {"error": f"ElevenLabs API error: {error_detail}"}

                result = await response.json()
                voice_id = result.get("voice_id")  # Get the voice ID from ElevenLabs
                print(voice_id)

                with engine.connect() as conn:
                    query = text(
                        """
                        INSERT INTO voices (external_id, user_id)
                        VALUES (:external_id, :user_id)
                        RETURNING id
                    """
                    )
                    db_result = conn.execute(
                        query,
                        {
                            "external_id": voice_id,
                            "user_id": user_id,
                        },
                    )
                    conn.commit()

                return {
                    "voice_id": voice_id,
                    "message": "Voice created and stored successfully",
                }

    except Exception as e:
        return {"error": str(e)}


@app.post("/end-call")
async def end_call(data: dict):
    try:
        caller_id = data.get("caller_id")
        recipient_id = data.get("recipient_id")

        if not caller_id or not recipient_id:
            raise HTTPException(status_code=400, detail="Missing user IDs")

        ongoing_calls.remove((caller_id, recipient_id))

        end_signal = {
            "type": "call_ended",
            "caller_id": caller_id,
            "recipient_id": recipient_id,
        }

        print("end signal: ", end_signal)

        if caller_id in connected_clients:
            await connected_clients[caller_id].send_json(end_signal)
        if recipient_id in connected_clients:
            await connected_clients[recipient_id].send_json(end_signal)

        return {"message": "Call ended successfully"}
    except Exception as e:
        return {"error": str(e)}


@app.post("/start-call")
async def start_call(data: dict):
    try:
        caller_id = data.get("caller_id")
        recipient_id = data.get("recipient_id")

        if not caller_id or not recipient_id:
            raise HTTPException(status_code=400, detail="Missing user IDs")

        # Send call signal to recipient's websocket
        call_signal = {
            "type": "incoming_call",
            "caller_id": caller_id,
            "recipient_id": recipient_id,
        }

        print("call signal: ", call_signal)
        print("connected clients: ", connected_clients)

        # Send only to the intended recipient
        if recipient_id in connected_clients:
            recipient_ws = connected_clients[recipient_id]
            await recipient_ws.send_json(call_signal)
            return {"message": "Call signal sent successfully"}
        else:
            raise HTTPException(status_code=404, detail="Recipient not connected")

    except Exception as e:
        print(f"Error sending call signal: {e}")
        return {"error": str(e)}


@app.post("/signup")
async def signup(data: dict):
    try:
        with engine.connect() as conn:
            query = text(
                """
                INSERT INTO users (first_name)
                VALUES (:first_name)
                RETURNING id, first_name
            """
            )
            result = conn.execute(query, {"first_name": data["first_name"]})
            user = result.fetchone()
            conn.commit()

            return {
                "id": str(user.id),
                "first_name": user.first_name,
                "language_code": "en",
            }
    except Exception as e:
        return {"error": str(e)}


@app.post("/login")
async def login(data: dict):
    try:
        with engine.connect() as conn:
            query = text(
                """
                SELECT id, first_name, language_code FROM users
                WHERE first_name = :first_name
                LIMIT 1
            """
            )
            result = conn.execute(query, {"first_name": data["first_name"]})
            user = result.fetchone()

            if not user:
                return {"error": "User not found"}, 404

            return {
                "id": str(user.id),
                "first_name": user.first_name,
                "language_code": user.language_code,
            }
    except Exception as e:
        return {"error": str(e)}


@app.get("/users")
async def get_users():
    try:
        with engine.connect() as conn:
            query = text("SELECT id, first_name, language_code FROM users")
            result = conn.execute(query)
            users = [
                {"id": str(row.id), "first_name": row.first_name} for row in result
            ]
            return users
    except Exception as e:
        return {"error": str(e)}


@app.get("/users/{user_id}/voices")
async def get_user_voices(user_id: str):
    try:
        with engine.connect() as conn:
            query = text(
                """
                SELECT v.id, v.external_id, v.created_at
                FROM voices v
                WHERE v.user_id = :user_id
                ORDER BY v.created_at DESC
                LIMIT 1
            """
            )
            print(user_id)
            result = conn.execute(query, {"user_id": user_id})
            voice = result.fetchone()

            if not voice:
                return None

            return {
                "id": str(voice.id),
                "external_id": voice.external_id,
                "created_at": voice.created_at.isoformat(),
            }
    except Exception as e:
        return {"error": str(e)}


@app.put("/users/{user_id}/language")
async def update_user_language(user_id: str, language_code: str = Form(...)):
    try:
        print(f"Updating language for user {user_id} to {language_code}")
        with engine.connect() as conn:
            query = text(
                """
                UPDATE users
                SET language_code = :language_code
                WHERE id = :user_id
                """
            )
            result = conn.execute(
                query, {"language_code": language_code, "user_id": user_id}
            )
            conn.commit()

            # print(f"Result: {result.rowcount}")

            print(f"Result: {result}")

            print(f"Result: {result.fetchone()}")

            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")

            return {"message": "Language code updated successfully"}
    except Exception as e:
        return {"error": str(e)}


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    try:
        with engine.connect() as conn:
            query = text(
                """
                SELECT id, first_name, language_code FROM users
                WHERE id = :user_id
                """
            )
            result = conn.execute(query, {"user_id": user_id})
            user = result.fetchone()

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            return {"id": str(user.id), "first_name": user.first_name}
    except Exception as e:
        return {"error": str(e)}


@app.post("/accept-call")
async def accept_call(data: dict):
    print("Accepting call")
    caller_id = data.get("caller_id")
    recipient_id = data.get("recipient_id")

    ongoing_calls.append((caller_id, recipient_id))

    if not caller_id or not recipient_id:
        raise HTTPException(status_code=400, detail="Missing caller_id or recipient_id")

    # Notify both parties that the call was accepted
    if caller_id in connected_clients:
        await connected_clients[caller_id].send_json(
            {"type": "call_accepted", "recipient_id": recipient_id}
        )

    if recipient_id in connected_clients:
        await connected_clients[recipient_id].send_json(
            {"type": "call_accepted", "caller_id": caller_id}
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
