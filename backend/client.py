import asyncio
import websockets
import subprocess
import json


async def test_audio_client():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        print("Connected to the audio server.")

        # Start mpv to play audio from standard input.
        mpv_process = subprocess.Popen(
            [
                "mpv",
                "--no-cache",
                "--no-terminal",
                "--demuxer-lavf-format=mp3",  # adjust format if needed
                "--cache-secs=0",
                "-",
            ],
            stdin=subprocess.PIPE,
        )

        try:
            while True:
                message = await websocket.recv()
                # Check if the received message is text or binary.
                if isinstance(message, str):
                    # Try to parse it as JSON.
                    try:
                        data = json.loads(message)
                        if data.get("end_of_stream"):
                            print("Received end-of-stream signal")
                            break
                        elif data.get("text"):
                            print("Received text message:", data["text"])
                    except Exception as e:
                        print("Error parsing text message:", e)
                else:
                    # It's binary audio data.
                    print("Received binary audio chunk of size:", len(message))
                    if mpv_process.stdin:
                        mpv_process.stdin.write(message)
                        mpv_process.stdin.flush()
        except websockets.exceptions.ConnectionClosed:
            print("Server closed the connection.")
        finally:
            if mpv_process.stdin:
                mpv_process.stdin.close()
            mpv_process.wait()


asyncio.run(test_audio_client())
