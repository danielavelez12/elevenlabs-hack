import {
  usePCMAudioListener,
  usePCMAudioRecorder,
} from "@speechmatics/browser-audio-input-react";
import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const RECORDING_SAMPLE_RATE = 16_000;

const AudioMicrophone: React.FC = () => {
  const { user } = useAuth();
  const { callState } = useAuth();
  const [isRecording, setIsRecording] = useState(false)
  const { startRecording, stopRecording } = usePCMAudioRecorder();
  const websocketRef = useRef<WebSocket | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [spacebarPressed, setSpacebarPressed] = useState(false);
  const [terminalChunkSent, setTerminalChunkSent] = useState(true);


  usePCMAudioListener((audio: Float32Array) => {
    if (spacebarPressed) {
      console.log("Sending audio chunk");
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(audio.buffer))
      );
      websocketRef.current?.send(
        JSON.stringify({ audio: base64Audio, terminal: false })
      );
    } else {
      console.log(
        "Spacebar not pressed, terminalChunkSent:",
        terminalChunkSent
      );
      if (!terminalChunkSent) {
        console.log("Sending terminal chunk");
        websocketRef.current?.send(
          JSON.stringify({ audio: "", terminal: true })
        );
        setTerminalChunkSent(true);
      }
    }
  });


  // Detecting spacebar presses
  useEffect(() => {
    const handleSpacebarPress = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setSpacebarPressed(true);
        setTerminalChunkSent(false);
      }
    };

    window.addEventListener("keydown", handleSpacebarPress);

    return () => {
      window.removeEventListener("keydown", handleSpacebarPress);
    };
  }, []);

  useEffect(() => {
    const handleSpacebarRelease = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setSpacebarPressed(false);
      }
    };

    window.addEventListener("keyup", handleSpacebarRelease);

    return () => {
      window.removeEventListener("keyup", handleSpacebarRelease);
    };
  }, []);

  // Receiving websocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        websocketRef.current = new WebSocket(
          `${import.meta.env.VITE_WS_SERVER_URL}/ws?user_id=${user?.id}&language_code=${user?.language_code}`
        );
      } catch (error) {
        console.error("WebSocket connection error:", error);
      }
    }

    connectWebSocket()

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // Add effect to handle call state changes
  useEffect(() => {
    if (
      callState.status === "ongoing" &&
      websocketRef.current?.readyState === WebSocket.OPEN
    ) {
      handleStartRecording({ deviceId: "default" });
    } else if (callState.status === "idle") {
      handleStopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState.status, websocketRef.current?.readyState]);
    
  const handleStartRecording = useCallback(async ({
      deviceId,
    }: {
      deviceId: string;
    }) => {
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
          audioContext: audioContext!,
        });
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Error accessing microphone: " + error);
      }
    },
    [startRecording]
  );

  const closeAudioContext = useCallback(() => {
    if (audioContext?.state !== "closed") {
      audioContext?.close();
    }
    setAudioContext(null);
  }, [audioContext]);

  const handleStopRecording = () => {
    stopRecording();
    closeAudioContext();
  };

  return (
    <div>
      <div
        style={{ marginTop: "20px", maxWidth: "500px" }}
        className="flex flex-col items-center"
      >
        {spacebarPressed ? (
          <Mic className="h-8 w-8 text-white" />
        ) : (
          <MicOff className="h-8 w-8 text-gray-500" />
        )}
        <p className="text-sm text-gray-400 mt-2">Spacebar to unmute</p>
      </div>
    </div>
  );
};

export default AudioMicrophone;
