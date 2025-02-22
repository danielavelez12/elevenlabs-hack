import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import App from "./App.tsx";
import { UserMenu } from "./components/UserMenu";
import { AuthProvider } from "./contexts/AuthContext";
import { PCMAudioRecorderProvider } from "@speechmatics/browser-audio-input-react";
import workletScriptURL from '@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url';

// Import Inter font - you'll need to install @fontsource/inter
import "@fontsource/inter";

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