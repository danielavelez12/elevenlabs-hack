"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "./ui/button";

const VoiceSetup: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = () => {
    setIsRecording(!isRecording);
    // Implement actual recording logic here
  };

  const handleCreateVoice = () => {
    // Implement voice creation logic here
    console.log("Creating voice...");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-white">Voice Setup</h2>
      <Button
        className={`px-4 py-2 rounded ${
          isRecording ? "bg-red-500" : "bg-blue-500"
        } text-white mr-4`}
        onClick={handleRecord}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </Button>
      <Button
        className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600"
        onClick={handleCreateVoice}
      >
        Create Voice
      </Button>
    </div>
  );
};

export default VoiceSetup;
