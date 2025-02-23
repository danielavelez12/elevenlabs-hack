import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type User = {
  id: string;
  first_name: string;
} | null;

type CallState = {
  status: "idle" | "incoming" | "ongoing";
  callerId?: string;
  callerName?: string;
  startTime?: Date;
};

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (userData: { id: string; first_name: string }) => void;
  logout: () => void;
  callState: CallState;
  setCallState: (state: CallState) => void;
  audioData?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User>(() => {
    // Initialize state from localStorage on component mount
    const savedUser = localStorage.getItem("user");
    console.log({ savedUser });
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  const [audioData, setAudioData] = useState<string>();

  useEffect(() => {
    // Simulate checking auth state
    setLoading(false);
  }, []);

  // Update the WebSocket connection effect
  useEffect(() => {
    let ws: WebSocket | null = null;

    if (user?.id) {
      ws = new WebSocket(`ws://localhost:8000/ws/start?user_id=${user.id}`);

      ws.onopen = () => {
        console.log("Call WebSocket connected for user:", user.id);
      };

      ws.onmessage = async (event) => {
        console.log({ event });
        const data = JSON.parse(event.data);
        if (data.type === "audio_chunk") {
          setAudioData(data.data);
        } else if (data.type === "incoming_call") {
          // Handle incoming call
          console.log("Incoming call from:", data.caller_id);
          try {
            const response = await fetch(
              `http://localhost:8000/users/${data.caller_id}`
            );
            if (response.ok) {
              const callerData = await response.json();
              setCallState({
                status: "incoming",
                callerId: data.caller_id,
                callerName: callerData.first_name,
              });
            }
          } catch (error) {
            console.error("Error fetching caller data:", error);
          }
        } else if (data.type === "call_accepted") {
          // Handle call accepted
          console.log("Call accepted by:", data.recipient_id);
          setCallState((prevState) => ({
            ...prevState,
            status: "ongoing",
            startTime: new Date(),
          }));
        }
      };

      ws.onclose = () => {
        console.log("Call WebSocket disconnected");
        setCallState({ status: "idle" });
      };

      ws.onerror = (error) => {
        console.error("Call WebSocket error:", error);
      };
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [user?.id]);

  useEffect(() => {
    // Update localStorage whenever user state changes
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const login = (userData: { id: string; first_name: string }) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        callState,
        setCallState,
        audioData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
