import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import MakeCall from "./components/MakeCall";
import Navbar from "./components/Navbar";
import VoiceSetup from "./components/VoiceSetup";

const App: React.FC = () => {
  return (
    <Router>
      <div className="flex h-screen">
        <div className="flex flex-col items-center pt-10">
          <div className="text-1xl font-bold text-white">skype</div>
          <Navbar />
        </div>
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
