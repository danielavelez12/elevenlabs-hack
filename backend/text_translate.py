from websocket import broadcast_audio_stream, start_websocket_server
from openai import OpenAI
from openai import AsyncOpenAI
import asyncio
import websockets
import json
import base64
import subprocess
import shutil
import os

from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    organization="org-wTKqrfyGm4y0SrDgy5jzh9SH",
    project="proj_TKDNPdEkva9jDdK19AGEN8w8",
)

completion = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "", "response_format": {"type": "json_object"}}
    ],
)


def translation_prompt(original_text: str, source_language: str, target_language: str):
    return f"Translate the following text from language code: {source_language} to language code: {target_language}: {original_text}"


def translate_text(
    original_text: str, source_language: str, target_language: str
) -> str:
    prompt = translation_prompt(original_text, source_language, target_language)
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
        )
        return completion.choices[0].message.content
    except Exception as e:
        raise Exception(f"Translation failed: {str(e)}")


async def text_chunker(chunks):
    """Split text into chunks, ensuring to not break sentences."""
    splitters = (".", ",", "?", "!", ";", ":", "—", "-", "(", ")", "[", "]", "}", " ")
    buffer = ""

    async for text in chunks:
        if buffer.endswith(splitters):
            yield buffer + " "
            buffer = text
        elif text.startswith(splitters):
            yield buffer + text[0] + " "
            buffer = text[1:]
        else:
            buffer += text

    if buffer:
        yield buffer + " "


def is_installed(lib_name):
    return shutil.which(lib_name) is not None


async def stream(audio_stream):
    """Stream audio data using mpv player."""
    if not is_installed("mpv"):
        raise ValueError(
            "mpv not found, necessary to stream audio. "
            "Install instructions: https://mpv.io/installation/"
        )

    mpv_process = subprocess.Popen(
        ["mpv", "--no-cache", "--no-terminal", "--", "fd://0"],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    async for chunk in audio_stream:
        if chunk:
            mpv_process.stdin.write(chunk)
            mpv_process.stdin.flush()

    if mpv_process.stdin:
        mpv_process.stdin.close()
    mpv_process.wait()


async def text_to_speech_input_streaming(
    voice_id, text_iterator, broadcast=False, recipient_id=None
):
    """Send text to ElevenLabs API and stream the returned audio."""
    uri = f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_flash_v2_5"

    async with websockets.connect(uri) as websocket:
        await websocket.send(
            json.dumps(
                {
                    "text": " ",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
                    "xi_api_key": os.getenv("ELEVENLABS_API_KEY"),
                }
            )
        )

        async def listen():
            while True:
                try:
                    message = await websocket.recv()
                    data = json.loads(message)
                    if data.get("audio"):
                        yield base64.b64decode(data["audio"])
                    elif data.get("isFinal"):
                        break
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed")
                    break

        if broadcast:
            listen_task = asyncio.create_task(
                broadcast_audio_stream(listen(), recipient_id=recipient_id)
            )
        else:
            listen_task = asyncio.create_task(stream(listen()))

        async for text in text_chunker(text_iterator):
            print(f"Sending to websocket: {text}")
            await websocket.send(json.dumps({"text": text}))

        await websocket.send(json.dumps({"end_of_stream": True}))

        await listen_task


async def translate_text_stream(
    original_text: str,
    source_language: str = "en",
    target_language: str = "es",
    broadcast=False,
    voice_id="xeg56Dz2Il4WegdaPo82",
    recipient_id=None,
):
    """Streaming version of translate_text that works with ElevenLabs"""
    print(
        f"[translate_text_stream] Translating from language code: {source_language} to language code: {target_language}: {original_text} to send to recipient: {recipient_id}"
    )
    prompt = translation_prompt(original_text, source_language, target_language)
    aclient = AsyncOpenAI(
        organization="org-wTKqrfyGm4y0SrDgy5jzh9SH",
        project="proj_TKDNPdEkva9jDdK19AGEN8w8",
    )

    try:
        response = await aclient.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )

        async def text_iterator():
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        await text_to_speech_input_streaming(
            voice_id, text_iterator(), broadcast, recipient_id
        )
    except Exception as e:
        raise Exception(f"Translation failed: {str(e)}")
