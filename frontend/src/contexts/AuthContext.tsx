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

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (userData: { id: string; first_name: string }) => void;
  logout: () => void;
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

  useEffect(() => {
    // Simulate checking auth state
    setLoading(false);
  }, []);

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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
