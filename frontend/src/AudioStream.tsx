import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./contexts/AuthContext";

interface AudioStreamProps {
  userId?: string;
}

const AudioStream: React.FC<AudioStreamProps> = ({ userId }) => {
  const { audioData, callState } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);

  // Add effect to start stream when call becomes ongoing
  useEffect(() => {
    if (callState.status === "ongoing" && !started) {
      setStarted(true);
      startStream();
    }
  }, [callState.status, started]);

  // Add effect to handle incoming audio data
  useEffect(() => {
    if (!audioData || !sourceBufferRef.current || !started) return;

    if (!sourceBufferRef.current.updating) {
      try {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        sourceBufferRef.current.appendBuffer(bytes);
      } catch (err) {
        console.error("Error appending buffer:", err);
      }
    }
  }, [audioData, started]);

  // Modify startStream to remove WebSocket setup
  const startStream = () => {
    if (!audioRef.current) return;

    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    audioRef.current.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener("sourceopen", () => {
      const mime = "audio/mpeg";
      try {
        const sourceBuffer = mediaSource.addSourceBuffer(mime);
        sourceBufferRef.current = sourceBuffer;
      } catch (error) {
        console.error("Error adding source buffer:", error);
      }
    });

    audioRef.current
      .play()
      .then(() => console.log("Playback started successfully"))
      .catch((err) => console.error("Playback error:", err));
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      mediaSourceRef.current?.removeEventListener("sourceopen", () => {});
    };
  }, []);

  return (
    <div>
      <audio ref={audioRef} />
    </div>
  );
};

export default AudioStream;
