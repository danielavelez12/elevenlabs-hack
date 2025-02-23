import {
  usePCMAudioListener,
  usePCMAudioRecorder,
} from "@speechmatics/browser-audio-input-react";
import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const RECORDING_SAMPLE_RATE = 16_000;
const CHUNK_INTERVAL = 3000; // 3 seconds in milliseconds

const AudioMicrophone2: React.FC = () => {
  const { user } = useAuth();
  const { callState } = useAuth();
  const { startRecording, stopRecording } = usePCMAudioRecorder();
  const websocketRef = useRef<WebSocket | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [websocketReady, setWebsocketReady] = useState(false);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  usePCMAudioListener((audio: Float32Array) => {
    if (isRecording) {
      audioBufferRef.current.push(new Float32Array(audio));
    }
  });

  const sendAudioChunk = useCallback(() => {
    console.log("Sending audio chunk");
    if (!audioBufferRef.current.length) return;

    // Concatenate all accumulated chunks
    const totalLength = audioBufferRef.current.reduce(
      (acc, chunk) => acc + chunk.length,
      0
    );
    const concatenatedAudio = new Float32Array(totalLength);
    let offset = 0;
    audioBufferRef.current.forEach((chunk) => {
      concatenatedAudio.set(chunk, offset);
      offset += chunk.length;
    });

    // Convert and send
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(concatenatedAudio.buffer))
    );

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(
        JSON.stringify({
          audio: base64Audio,
          terminal: true,
        })
      );
    }

    // Clear the buffer
    audioBufferRef.current = [];
  }, []);

  // WebSocket connection setup
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        websocketRef.current = new WebSocket(
          `${import.meta.env.VITE_WS_SERVER_URL}/ws?user_id=${user?.id}`
        );
      } catch (error) {
        console.error("WebSocket connection error:", error);
      }
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [user?.id]);

  // Track WebSocket ready state using event listeners
  useEffect(() => {
    if (!websocketRef.current) return;

    const handleOpen = () => {
      setWebsocketReady(true);
      console.log("WebSocket open");
    };
    const handleClose = () => {
      setWebsocketReady(false);
      console.log("WebSocket closed");
    };

    websocketRef.current.addEventListener("open", handleOpen);
    websocketRef.current.addEventListener("close", handleClose);

    return () => {
      websocketRef.current?.removeEventListener("open", handleOpen);
      websocketRef.current?.removeEventListener("close", handleClose);
    };
  }, []);

  const closeAudioContext = useCallback(() => {
    if (audioContext?.state !== "closed") {
      audioContext?.close();
    }
    setAudioContext(null);
  }, [audioContext]);

  const handleStartRecording = useCallback(
    async ({ deviceId }: { deviceId: string }) => {
      if (websocketRef.current?.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not connected");
        alert("WebSocket is not connected. Please wait for connection.");
        return;
      }

      const audioContext = new AudioContext({
        sampleRate: RECORDING_SAMPLE_RATE,
      });
      await audioContext.audioWorklet.addModule("/js/pcm-audio-worklet.min.js");
      setAudioContext(audioContext);

      try {
        await startRecording({
          deviceId,
          audioContext,
        });
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Error accessing microphone: " + error);
      }
    },
    [startRecording]
  );

  const handleStopRecording = useCallback(() => {
    stopRecording();
    closeAudioContext();
  }, [stopRecording, closeAudioContext]);

  // Handle call state changes; ensure this runs only on actual transitions.
  useEffect(() => {
    console.log("callState.status", callState.status);
    console.log("websocketReady", websocketReady);

    if (callState.status === "ongoing" && websocketReady && !isRecording) {
      handleStartRecording({ deviceId: "default" });
      setIsRecording(true);
      // Start the interval for sending chunks
      chunkIntervalRef.current = setInterval(sendAudioChunk, CHUNK_INTERVAL);
    } else if (callState.status === "idle" && isRecording) {
      handleStopRecording();
      setIsRecording(false);
      // Clear the interval
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }
    }
  }, [callState.status, websocketReady]);

  return (
    <div>
      <div
        style={{ marginTop: "20px", maxWidth: "500px" }}
        className="flex flex-col items-center"
      >
        {isRecording ? (
          <Mic className="h-8 w-8 text-white" />
        ) : (
          <MicOff className="h-8 w-8 text-gray-500" />
        )}
        <p className="text-sm text-gray-400 mt-2">
          {isRecording ? "Recording..." : "Microphone off"}
        </p>
      </div>
    </div>
  );
};

export default AudioMicrophone2;
