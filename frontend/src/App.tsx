import "./App.css";
import SetupVoice from "./SetupVoice";
function App() {
  return (
    <>
      {/* <AudioStream /> */}
      <SetupVoice apiKey={import.meta.env.VITE_ELEVENLABS_API_KEY} />
    </>
  );
}

export default App;
