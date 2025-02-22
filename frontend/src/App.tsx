import "./App.css";
import AudioStream from "./AudioStream";
function App() {
  return (
    <>
      <AudioStream />
      {/* <SetupVoice apiKey={import.meta.env.VITE_ELEVENLABS_API_KEY} /> */}
    </>
  );
}

export default App;
