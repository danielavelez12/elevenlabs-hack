from text_translate import translate_text, translate_text_stream, start_websocket_server
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import aiohttp
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from datetime import datetime
from contextlib import asynccontextmanager


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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Database setup
DB_URL = os.getenv("DB_URL")
engine = create_engine(DB_URL)

# Global variable for websocket server
websocket_server = None


@app.get("/")
async def root():
    return {"message": "Audio processing server is running"}


@app.post("/upload-audio")
async def upload_audio(audio_file: UploadFile = File(...)):
    try:
        content = await audio_file.read()

        # TODO: convert audio to text (Reet)
        translated_text = ""

        # TODO: translate text (Daniela)
        translated_text = translate_text(translated_text)

        return {
            "filename": audio_file.filename,
            "content_type": audio_file.content_type,
            "file_size": len(content),
        }

    except Exception as e:
        return {"error": str(e)}


@app.post("/create-voice")
async def create_voice(voice_name: str = Form(...), audio_file: UploadFile = File(...)):
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

                # Store voice information in database
                user_id = "4f17d98c-e785-43d6-9fad-630a65f15e78"  # Your user ID
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


@app.post("/start-call")
async def start_call():
    try:
        if not websocket_server:
            raise Exception("WebSocket server not initialized")

        test_text = "Hello, how are you?"
        await translate_text_stream(test_text, "Spanish", broadcast=True)
        return {"message": "Call started successfully"}
    except Exception as e:
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

            return {"id": str(user.id), "first_name": user.first_name}
    except Exception as e:
        return {"error": str(e)}


@app.post("/login")
async def login(data: dict):
    try:
        with engine.connect() as conn:
            query = text(
                """
                SELECT id, first_name FROM users
                WHERE first_name = :first_name
                LIMIT 1
            """
            )
            result = conn.execute(query, {"first_name": data["first_name"]})
            user = result.fetchone()

            if not user:
                return {"error": "User not found"}, 404

            return {"id": str(user.id), "first_name": user.first_name}
    except Exception as e:
        return {"error": str(e)}


@app.get("/users")
async def get_users():
    try:
        with engine.connect() as conn:
            query = text("SELECT id, first_name FROM users")
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
