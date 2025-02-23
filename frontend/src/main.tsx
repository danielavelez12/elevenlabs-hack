import { PCMAudioRecorderProvider } from "@speechmatics/browser-audio-input-react";
import workletScriptURL from "@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import App from "./App.tsx";
import { UserMenu } from "./components/UserMenu";
import { AuthProvider } from "./contexts/AuthContext";

// Import Inter font weights you need
import "@fontsource/inter/400.css"; // Regular
import "@fontsource/inter/500.css"; // Medium
import "@fontsource/inter/600.css"; // Semi-bold
import "@fontsource/inter/700.css"; // Bold

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <PCMAudioRecorderProvider workletScriptURL={workletScriptURL}>
        <div className="flex h-screen text-white">
          <main
            className="flex-1 overflow-auto relative"
            style={{ backgroundColor: "#1C1E2E" }}
          >
            <App />
            <UserMenu />
          </main>
        </div>
      </PCMAudioRecorderProvider>
    </AuthProvider>
  </StrictMode>
);
