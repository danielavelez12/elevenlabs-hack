"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { UserAuthModal } from "./UserAuthModal";

const VoiceSetup: React.FC = () => {
  const { user, loading, login } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    user?.language_code || ""
  );
  const [isLanguageUpdating, setIsLanguageUpdating] = useState(false);

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "hi", name: "Hindi" },
    { code: "cmn", name: "Chinese" },
    { code: "fr", name: "French" },
    { code: "ar", name: "Arabic" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
  ];

  // State management
  const [voiceName, setVoiceName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [existingVoice, setExistingVoice] = useState<{
    id: string;
    external_id: string;
    created_at: string;
  } | null>(null);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
      });

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access your microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCreateVoice = async () => {
    if (!user) {
      setError("Please log in first.");
      return;
    }
    if (!voiceName) {
      setError("Please enter a voice name.");
      return;
    }
    if (!audioBlob) {
      setError("Please record some audio first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    const formData = new FormData();
    formData.append("voice_name", voiceName);
    formData.append("audio_file", audioBlob, "recording.webm");
    formData.append("user_id", user.id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_SERVER_URL}/create-voice`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();
      console.log("Voice clone created:", data);
      // Reset form fields
      setVoiceName("");
      setAudioBlob(null);
      setIsSuccess(true);
    } catch (err) {
      console.error("Error creating voice clone:", err);
      setError("Error creating voice clone.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingVoice = async (userId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_SERVER_URL}/users/${userId}/voices`
      );
      if (!response.ok) throw new Error("Failed to fetch voice");
      const data = await response.json();
      setExistingVoice(data);
      console.log("Existing voice:", data);
    } catch (err) {
      console.error("Error fetching voice:", err);
    }
  };

  const handleResetVoice = () => {
    setExistingVoice(null);
    setIsSuccess(false);
  };

  const handleAuthSuccess = (userData: {
    id: string;
    first_name: string;
    language_code: string;
  }) => {
    login(userData);
    setShowAuthModal(false);
  };

  // Add language update handler
  const handleLanguageUpdate = async (language: string) => {
    if (!user) {
      setError("Please log in first.");
      return;
    }

    setIsLanguageUpdating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("language_code", language);

      const response = await fetch(
        `http://localhost:8000/users/${user.id}/language`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update language");
      }

      setSelectedLanguage(language);
    } catch (err) {
      console.error("Error updating language:", err);
      setError("Failed to update language preference.");
    } finally {
      setIsLanguageUpdating(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchExistingVoice(user.id);
    }
  }, [user]);

  return (
    <div className="flex flex-col space-y-6 items-center justify-center h-full max-w-md mx-auto p-6">
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : (
        user && (
          <>
            {error && (
              <Alert variant="destructive" className="animate-float-in">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Add Language Selection Card */}
            <Card className=" animate-float-in shadow-lg rounded-lg">
              <CardContent className="px-4">
                <div className="flex flex-col space-y-4">
                  <label className="text-sm font-medium text-white">
                    Select language
                  </label>
                  <Select
                    value={selectedLanguage}
                    onValueChange={(value) => handleLanguageUpdate(value)}
                    disabled={isLanguageUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isLanguageUpdating && (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            {existingVoice ? (
              <Card className=" animate-float-in">
                <div className="flex-col mb-4">
                  <div className="flex items-center text-">
                    <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                    <span>Voice ready</span>
                  </div>
                  <div className="text-xs">
                    <span>
                      Added on{" "}
                      {new Date(existingVoice.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="default"
                  onClick={handleResetVoice}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                >
                  Reset voice
                </Button>
              </Card>
            ) : (
              <>
                {isSuccess ? (
                  <Card className="flex items-center text-green-500 animate-float-in">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    <span>Voice setup finished</span>
                  </Card>
                ) : (
                  <>
                    <Card className="animate-float-in">
                      <CardContent>
                        <Input
                          id="voiceName"
                          className="text-white hover:text-white"
                          value={voiceName}
                          onChange={(e) => setVoiceName(e.target.value)}
                          placeholder="Enter voice name"
                        />
                        <Button
                          onClick={isRecording ? stopRecording : startRecording}
                          className="w-full text-white bg-blue-500 hover:bg-blue-600 h-10 mt-4"
                        >
                          {isRecording
                            ? "Stop recording"
                            : audioBlob
                            ? "Record again"
                            : "Start recording"}
                        </Button>
                      </CardContent>
                    </Card>
                    {audioBlob && (
                      <Card className="animate-float-in">
                        <CardContent>
                          <audio
                            controls
                            src={URL.createObjectURL(audioBlob)}
                            className="w-full mb-4"
                          />
                          <Button
                            variant="default"
                            onClick={handleCreateVoice}
                            className="w-full text-white bg-green-500 hover:bg-green-600 h-10"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating voice...
                              </>
                            ) : (
                              "Create voice"
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )
      )}
      {!user && (
        <UserAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
};

export default VoiceSetup;
