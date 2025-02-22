import React, { useEffect, useRef, useState } from "react";

const AudioStream: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startStream = () => {
    if (!audioRef.current) return;

    // Create and attach a MediaSource.
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    // Set the src before attempting playback.
    audioRef.current.src = URL.createObjectURL(mediaSource);

    // Now, attach the sourceopen event.
    mediaSource.addEventListener("sourceopen", () => {
      const mime = "audio/mpeg"; // adjust MIME type as needed
      try {
        const sourceBuffer = mediaSource.addSourceBuffer(mime);
        sourceBufferRef.current = sourceBuffer;
      } catch (error) {
        console.error("Error adding source buffer:", error);
        return;
      }

      // Set up the WebSocket connection.
      wsRef.current = new WebSocket("ws://localhost:8765");
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        console.log("WebSocket connection opened.");
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          try {
            const data = JSON.parse(event.data);
            if (data.end_of_stream) {
              console.log("Received end-of-stream signal");
              mediaSource.endOfStream();
            }
          } catch (err) {
            console.error("Error parsing JSON:", err);
          }
        } else {
          const uint8Array = new Uint8Array(event.data as ArrayBuffer);
          if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
            try {
              sourceBufferRef.current.appendBuffer(uint8Array);
            } catch (err) {
              console.error("Error appending buffer:", err);
            }
          } else {
            console.warn("SourceBuffer busy; consider queueing data.");
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket connection closed.");
      };
    });

    // Now that the src is set, call play.
    audioRef.current
      .play()
      .then(() => {
        console.log("Playback started successfully");
      })
      .catch((err) => {
        console.error("Playback error:", err);
      });
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      mediaSourceRef.current?.removeEventListener("sourceopen", () => {});
    };
  }, []);

  return (
    <div>
      <audio ref={audioRef} controls />
      {!started && (
        <button
          onClick={() => {
            setStarted(true);
            startStream();
          }}
        >
          Start Audio Stream
        </button>
      )}
    </div>
  );
};

export default AudioStream;
