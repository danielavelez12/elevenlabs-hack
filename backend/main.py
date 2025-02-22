from text_translate import translate_text
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import aiohttp
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from datetime import datetime

app = FastAPI()

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
