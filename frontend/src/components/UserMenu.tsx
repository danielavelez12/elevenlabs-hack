import { LogOut, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return null;

  return (
    <div className="fixed bottom-4 left-4">
      <Button
        variant="ghost"
        className="flex items-center p-2 gap-2 hover:bg-[#343645]"
        onClick={() => setShowMenu(!showMenu)}
      >
        <User size={20} />
        <span>{user.first_name}</span>
      </Button>

      {showMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-[#202533] rounded-md shadow-lg p-1">
          <Button
            variant="ghost"
            className="flex items-center gap-2 p-2 text-red-500 hover:bg-[#343645] hover:text-red-400 w-full"
            onClick={() => {
              logout();
              setShowMenu(false);
            }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </Button>
        </div>
      )}
    </div>
  );
}
