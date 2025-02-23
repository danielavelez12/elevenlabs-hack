import { Clock, Loader2, PhoneCall, PhoneOff } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import AudioStream from "../AudioStream";
import { AudioVisualizer } from "../AudioVisualizer";
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
import AudioMicrophone from "./AudioMicrophone";

type Timeout = ReturnType<typeof setInterval>;

const MakeCall: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; first_name: string }>>(
    []
  );
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [showAuthModal, setShowAuthModal] = useState(true);
  const {
    user,
    loading: authLoading,
    login,
    callState,
    setCallState,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");
  const timerRef = useRef<Timeout | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (callState.status === "ongoing" && callState.startTime) {
      timerRef.current = setInterval(() => {
        const elapsed = new Date().getTime() - callState.startTime!.getTime();
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setElapsedTime(
          `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        );
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callState.status, callState.startTime]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (userData: { id: string; first_name: string }) => {
    login(userData);
    fetchUsers();
  };

  const handleStartCall = async () => {
    try {
      if (!user || !selectedUser) {
        throw new Error("Missing user information");
      }

      setStarted(true);

      const response = await fetch("http://localhost:8000/start-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caller_id: user.id,
          recipient_id: selectedUser,
        }),
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

  const handleAcceptCall = async () => {
    try {
      if (!user || !callState.callerId) {
        throw new Error("Missing user information");
      }

      const response = await fetch("http://localhost:8000/accept-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caller_id: callState.callerId,
          recipient_id: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to accept call");
      }

      // The call state will be updated via websocket when we receive the call_accepted event
    } catch (error) {
      console.error("Error accepting call:", error);
      setCallState({ status: "idle" });
    }
  };

  const handleRejectCall = () => {
    setCallState({ status: "idle" });
  };

  const renderCallInterface = () => {
    switch (callState.status) {
      case "incoming":
        return (
          <Card className="animate-float-in p-6 space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <PhoneCall className="h-6 w-6 text-blue-500 animate-pulse" />
              <span className="text-lg">
                {callState.callerName} is calling...
              </span>
            </div>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={handleAcceptCall}
                className="bg-green-500 hover:bg-green-600 w-60"
              >
                Accept
              </Button>
              <Button
                onClick={handleRejectCall}
                className="bg-red-500 hover:bg-red-600 w-60"
              >
                Decline
              </Button>
            </div>
          </Card>
        );

      case "ongoing":
        return (
          <Card className="animate-float-in p-6 space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Ongoing call with {callState.callerName}</span>
            </div>
            <div className="flex items-center justify-center text-gray-400">
              <Clock className="h-4 w-4 mr-2" />
              <span>{elapsedTime}</span>
            </div>
            <AudioStream userId={user?.id} />
            <AudioVisualizer />
            <AudioMicrophone />
            <Button
              onClick={handleRejectCall}
              className="bg-red-500 hover:bg-red-600 w-full"
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              End Call
            </Button>
          </Card>
        );

      default:
        return (
          <Card className="animate-float-in">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select user to call" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => u.id !== user.id)
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <AudioStream userId={user?.id} />
            <Button
              className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 h-10 w-60 mt-4"
              onClick={handleStartCall}
              disabled={started || !selectedUser}
            >
              {started ? "Call in progress..." : "Start call"}
            </Button>
          </Card>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-6 items-center justify-center h-full max-w-md mx-auto p-6">
      {authLoading || loading ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : (
        user && renderCallInterface()
      )}
      {!authLoading && !user && (
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
