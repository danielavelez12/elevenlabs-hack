import React, { useRef, useState } from "react";

interface VoiceCloneFormProps {
  apiKey: string;
}

const VoiceCloneForm: React.FC<VoiceCloneFormProps> = ({ apiKey }) => {
  const [voiceName, setVoiceName] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start recording audio from the microphone
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
      });

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access your microphone.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // Submit the form: call our backend API endpoint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      setError("API key is required.");
      return;
    }
    if (!voiceName) {
      setError("Please enter a voice name.");
      return;
    }
    if (!audioBlob) {
      setError("Please record some audio first.");
      return;
    }

    const formData = new FormData();
    formData.append("voice_name", voiceName);
    formData.append("audio_file", audioBlob, "recording.webm");

    try {
      const response = await fetch("http://localhost:8000/create-voice", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();
      console.log("Voice clone created:", data);
      setVoiceId(data.voice_id);
      // Reset form fields after successful call
      setVoiceName("");
      setAudioBlob(null);
    } catch (err) {
      console.error("Error creating voice clone:", err);
      setError("Error creating voice clone.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Create Voice Clone</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500">{error}</p>}
        <div>
          <label
            htmlFor="voiceName"
            className="block text-sm font-medium text-gray-700"
          >
            Voice Name
          </label>
          <input
            type="text"
            id="voiceName"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded p-2"
            required
          />
        </div>
        <div>
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Stop Recording
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Start Recording
            </button>
          )}
        </div>
        <div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white px-4 py-2 rounded"
          >
            Create Voice Clone
          </button>
        </div>
      </form>
      {audioBlob && (
        <div className="mt-4">
          <p className="text-sm text-gray-700">Recorded Audio Preview:</p>
          <audio controls src={URL.createObjectURL(audioBlob)} />
        </div>
      )}
    </div>
  );
};

export default VoiceCloneForm;
