import React, { useState, useEffect } from 'react';
import '../../styles/VoiceNoteButton.css';

interface VoiceNoteButtonProps {
  onTranscript: (transcript: string) => void;
}

const VoiceNoteButton: React.FC<VoiceNoteButtonProps> = ({ onTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);

      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      let finalTranscript = '';

      recognitionInstance.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        if (finalTranscript.trim()) {
          onTranscript(finalTranscript.trim());
          finalTranscript = '';
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      setRecognition(recognitionInstance);
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const handleToggleRecording = () => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  if (!isSupported) {
    return null; // Don't show button if not supported
  }

  return (
    <button
      type="button"
      className={`voice-note-button ${isRecording ? 'recording' : ''}`}
      onClick={handleToggleRecording}
      title={isRecording ? 'Stop recording' : 'Start voice note'}
    >
      {isRecording ? (
        <>
          <span className="recording-icon">🔴</span>
          <span className="recording-pulse"></span>
        </>
      ) : (
        <span className="microphone-icon">🎤</span>
      )}
    </button>
  );
};

export default VoiceNoteButton;
