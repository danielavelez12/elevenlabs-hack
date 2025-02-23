import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: { id: string; first_name: string; language_code: string }) => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState("");
  const [isSignup, setIsSignup] = useState(true);

  const handleSubmit = async () => {
    try {
      const endpoint = isSignup ? "/signup" : "/login";
      const response = await fetch(
        `${import.meta.env.VITE_API_SERVER_URL}${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ first_name: firstName }),
        }
      );

      if (!response.ok) throw new Error("Auth failed");

      const userData = await response.json();
      onSuccess(userData);
      onClose();
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="py-10">
        <DialogHeader>
          <DialogTitle>
            {isSignup
              ? "Create a Skype account"
              : "Log into your Skype account"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Enter your first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Button
            onClick={handleSubmit}
            className="w-full bg-blue-500 hover:bg-blue-600 h-10"
          >
            {isSignup ? "Sign up" : "Login"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setIsSignup(!isSignup)}
            className="w-full"
          >
            {isSignup
              ? "Already have an account? Login"
              : "Need an account? Sign up"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
