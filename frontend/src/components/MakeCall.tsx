import type React from "react";
import { Button } from "./ui/button";

const MakeCall: React.FC = () => {
  const handleStartCall = () => {
    // Implement call logic here
    console.log("Starting call...");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-white">Make a Call</h2>
      <Button
        className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600"
        onClick={handleStartCall}
      >
        Start Call
      </Button>
    </div>
  );
};

export default MakeCall;
