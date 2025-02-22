import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import MakeCall from "./components/MakeCall";
import Navbar from "./components/Navbar";
import VoiceSetup from "./components/VoiceSetup";

const App: React.FC = () => {
  return (
    <Router>
      <div className="flex h-screen">
        <Navbar />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/voice-setup" element={<VoiceSetup />} />
            <Route path="/make-call" element={<MakeCall />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
