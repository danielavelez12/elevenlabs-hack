from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Audio processing server is running"}


@app.post("/upload-audio")
async def upload_audio(audio_file: UploadFile = File(...)):
    try:
        content = await audio_file.read()

        return {
            "filename": audio_file.filename,
            "content_type": audio_file.content_type,
            "file_size": len(content),
        }
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
