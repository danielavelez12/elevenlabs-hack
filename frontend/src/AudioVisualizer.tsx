import { useEffect, useRef } from "react";
import { useAuth } from "./contexts/AuthContext";

export const AudioVisualizer = () => {
  const { audioData } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousDataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    console.log("AudioVisualizer running");
    if (!audioData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 200;

    // Convert base64 audio data to array buffer
    const binaryStr = window.atob(audioData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Create audio context and analyzer
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Initialize previous data array
    if (!previousDataRef.current) {
      previousDataRef.current = new Uint8Array(bufferLength);
    }

    // Smoothing function
    const smoothData = (
      current: Uint8Array,
      previous: Uint8Array,
      smoothingFactor: number = 0.8
    ) => {
      for (let i = 0; i < bufferLength; i++) {
        current[i] =
          previous[i] * smoothingFactor + current[i] * (1 - smoothingFactor);
      }
      return current;
    };

    // Create audio buffer from array buffer
    audioContext
      .decodeAudioData(bytes.buffer)
      .then((audioBuffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        source.start(0);

        // Animation function
        const draw = () => {
          requestAnimationFrame(draw);

          // Get frequency data
          analyser.getByteFrequencyData(dataArray);

          // Apply smoothing
          const smoothedData = smoothData(dataArray, previousDataRef.current);
          previousDataRef.current.set(smoothedData);

          // Clear canvas with full transparency
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw frequency bars
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            barHeight = (smoothedData[i] / 255) * canvas.height;

            // Create gradient for each bar
            const gradient = ctx.createLinearGradient(
              x,
              canvas.height - barHeight,
              x,
              canvas.height
            );
            gradient.addColorStop(0, "rgba(61, 81, 223, 0.8)"); // Bright blue
            gradient.addColorStop(0.5, "rgba(147, 51, 223, 0.6)"); // Purple
            gradient.addColorStop(1, "rgba(223, 51, 118, 0.4)"); // Pink

            ctx.fillStyle = gradient;

            // Draw bar with rounded corners
            ctx.beginPath();
            ctx.roundRect(
              x,
              canvas.height - barHeight,
              barWidth - 2,
              barHeight,
              5
            );
            ctx.fill();

            x += barWidth;
          }
        };

        draw();
      })
      .catch((err) => {
        console.error("Error decoding audio data:", err);
      });

    // Cleanup
    return () => {
      audioContext.close();
    };
  }, [audioData]);

  return (
    <div className="w-full flex justify-center items-center p-4">
      <canvas
        ref={canvasRef}
        className="rounded-lg"
        style={{
          maxWidth: "100%",
        }}
      />
    </div>
  );
};
