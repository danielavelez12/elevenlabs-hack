import { useState, useRef, useEffect, useCallback } from 'react'
import {
  usePCMAudioListener,
  usePCMAudioRecorder,
} from "@speechmatics/browser-audio-input-react";

const RECORDING_SAMPLE_RATE = 16_000;

const AudioMicrophone: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [connectionStatus, setConnectionStatus] = useState('Disconnected')
    const { startRecording, stopRecording } = usePCMAudioRecorder()
    const websocketRef = useRef<WebSocket | null>(null)
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
    const [spacebarPressed, setSpacebarPressed] = useState(false)
    const [terminalChunkSent, setTerminalChunkSent] = useState(true)
  
    usePCMAudioListener((audio: Float32Array) => {
      if (spacebarPressed) {
        console.log('Sending audio chunk')
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audio.buffer)));
        websocketRef.current?.send(JSON.stringify({ audio: base64Audio, terminal: false }))
      } else {
        if (!terminalChunkSent) {
          console.log('Sending terminal chunk')
          websocketRef.current?.send(JSON.stringify({ audio: '', terminal: true }))
          setTerminalChunkSent(true)
        }
      }
    })
  
    // Detecting spacebar presses
    useEffect(() => {
      const handleSpacebarPress = (event: KeyboardEvent) => {
        if (event.key === ' ') {
          setSpacebarPressed(true)
          setTerminalChunkSent(false)
        }
      } 
  
      window.addEventListener('keydown', handleSpacebarPress)
  
      return () => {
        window.removeEventListener('keydown', handleSpacebarPress)
      }
    }, [])
  
    useEffect(() => {
      const handleSpacebarRelease = (event: KeyboardEvent) => {
        if (event.key === ' ') {
          setSpacebarPressed(false)
        }
      }
  
      window.addEventListener('keyup', handleSpacebarRelease)
  
  
      return () => {
        window.removeEventListener('keyup', handleSpacebarRelease)
      }
    }, [])
    
    // Receiving websocket connection
    useEffect(() => {
      const connectWebSocket = () => {
        try {
          websocketRef.current = new WebSocket('ws://localhost:8000/ws')
          
          websocketRef.current.onopen = () => {
            console.log('WebSocket connected')
            setConnectionStatus('Connected')
          }
  
          websocketRef.current.onmessage = (event) => {
            console.log('Received message:', event.data)
            setTranscript(prev => prev + ' ' + event.data)
          }
  
          websocketRef.current.onerror = (error) => {
            console.error('WebSocket error:', error)
            setConnectionStatus('Error')
          }
  
          websocketRef.current.onclose = () => {
            console.log('WebSocket closed')
            setConnectionStatus('Disconnected')
            // Attempt to reconnect after 2 seconds
            setTimeout(connectWebSocket, 2000)
          }
        } catch (error) {
          console.error('WebSocket connection error:', error)
          setConnectionStatus('Error')
        }
      }
  
      connectWebSocket()
  
      return () => {
        if (websocketRef.current) {
          websocketRef.current.close()
        }
      }
    }, [])
    
    const handleStartRecording = useCallback(async ({
      deviceId,
    }: {
      deviceId: string;
    }) => {
      if (websocketRef.current?.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected')
        alert('WebSocket is not connected. Please wait for connection.')
        return
      }
  
      const audioContext = new AudioContext({
        sampleRate: RECORDING_SAMPLE_RATE,
      });
      await audioContext.audioWorklet.addModule('/js/pcm-audio-worklet.min.js');
      setAudioContext(audioContext);
  
      try {
        await startRecording({
          deviceId,
          audioContext: audioContext!,
        });
        setIsRecording(true)
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('Error accessing microphone: ' + error)
      }
    }, [startRecording])
  
    const closeAudioContext = useCallback(() => {
      if (audioContext?.state !== "closed") {
        audioContext?.close();
      }
      setAudioContext(null);
    }, [audioContext]);
  
    const handleStopRecording = () => {
      stopRecording();
      closeAudioContext();
      setIsRecording(false)
    }  

    return (
        <div>
            <h1>Audio Transcription Test</h1>
            <div className="card">
                <div style={{ marginBottom: '10px' }}>
                Connection Status: <span style={{
                    color: connectionStatus === 'Connected' ? 'green' : 
                        connectionStatus === 'Error' ? 'red' : 'orange'
                }}>{connectionStatus}</span>
                </div>
                
                <button 
                onClick={isRecording ? handleStopRecording : () => handleStartRecording({ deviceId: 'default' })}
                style={{ 
                    backgroundColor: isRecording ? 'red' : 'green',
                    opacity: connectionStatus !== 'Connected' ? 0.5 : 1
                }}
                disabled={connectionStatus !== 'Connected'}
                >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
                
                <div style={{ marginTop: '20px', maxWidth: '500px' }}>
                <h3>Transcript:</h3>
                <p>{transcript}</p>
                </div>

                <div style={{ marginTop: '20px', maxWidth: '500px' }}>
                <h3>Spacebar Pressed:</h3>
                <p style={{ color: spacebarPressed ? 'green' : 'red' }}>{spacebarPressed ? 'True' : 'False'}</p>
                </div>
            </div>
    </div>
    )
}

export default AudioMicrophone;
