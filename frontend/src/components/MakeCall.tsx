import { Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { UserAuthModal } from "./UserAuthModal";

const MakeCall: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; first_name: string }>>(
    []
  );
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading, login } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:8000/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleAuthSuccess = (userData: { id: string; first_name: string }) => {
    login(userData);
    fetchUsers();
  };

  const startAudioStream = () => {
    if (!audioRef.current) return;

    // Create and attach MediaSource
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    audioRef.current.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener("sourceopen", () => {
      try {
        const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        sourceBufferRef.current = sourceBuffer;

        // Set up WebSocket connection
        wsRef.current = new WebSocket("ws://localhost:8765");
        wsRef.current.binaryType = "arraybuffer";

        wsRef.current.onmessage = (event: MessageEvent) => {
          console.log("Received message:", event.data);
          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);
              if (data.end_of_stream) {
                // Wait for any pending updates before ending the stream
                const waitForUpdates = () => {
                  if (sourceBufferRef.current?.updating) {
                    setTimeout(waitForUpdates, 50);
                  } else {
                    mediaSource.endOfStream();
                  }
                };
                waitForUpdates();
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
            }
          }
        };
      } catch (error) {
        console.error("Error setting up audio stream:", error);
      }
    });

    audioRef.current.play().catch((err) => {
      console.error("Playback error:", err);
    });
  };

  const handleStartCall = async () => {
    try {
      setStarted(true);
      startAudioStream(); // Start audio stream first

      const response = await fetch("http://localhost:8000/start-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to start call");
      }

      const data = await response.json();
      console.log("Call started:", data);
    } catch (error) {
      console.error("Error starting call:", error);
      setStarted(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 items-center justify-center h-full max-w-md mx-auto p-6">
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : user ? (
        <Card className="animate-float-in p-4">
          <div className="mb-4">Welcome, {user.first_name}!</div>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select user to call" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((user) => user.id !== user.id)
                .map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <audio ref={audioRef} className="mb-4" />
          <Button
            className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 h-10 w-60 mt-4"
            onClick={handleStartCall}
            disabled={started || !selectedUser}
          >
            {started ? "Call in progress..." : "Start call"}
          </Button>
        </Card>
      ) : (
        <Button onClick={() => setShowAuthModal(true)}>Sign Up / Login</Button>
      )}
      {!loading && !user && (
        <UserAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
};

export default MakeCall;
