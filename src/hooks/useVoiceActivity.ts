import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioVADManager, VADOptions } from '../modules/audioVAD';

export interface UseVoiceActivityProps {
  mediaStream?: MediaStream | null;
  audioTrack?: MediaStreamTrack | null;
  isMuted?: boolean;
  speakingThreshold?: number;
  onVoiceActiveChange?: (isSpeaking: boolean, volume: number) => void;
  sendWebSocketMessage?: (message: any) => void;
}

export function useVoiceActivity({
  mediaStream,
  audioTrack,
  isMuted = false,
  speakingThreshold = 12,
  onVoiceActiveChange,
  sendWebSocketMessage,
}: UseVoiceActivityProps = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const vadManagerRef = useRef<AudioVADManager | null>(null);

  // Initialize or update VAD manager
  useEffect(() => {
    const vad = new AudioVADManager({
      speakingThreshold,
      onVoiceActiveChange: (speaking, vol) => {
        setIsSpeaking(speaking);
        if (onVoiceActiveChange) {
          onVoiceActiveChange(speaking, vol);
        }
        if (sendWebSocketMessage) {
          sendWebSocketMessage({
            type: 'voice:active',
            isSpeaking: speaking,
            volume: vol,
            audioLevel: vol,
          });
        }
      },
      onVolumeChange: (vol) => {
        setVolume(vol);
      },
    });

    vadManagerRef.current = vad;

    // Attach stream if provided
    if (mediaStream) {
      vad.initializeWithStream(mediaStream);
    } else if (audioTrack) {
      const stream = new MediaStream([audioTrack]);
      vad.initializeWithStream(stream);
    }

    return () => {
      vad.cleanup();
      vadManagerRef.current = null;
    };
  }, [mediaStream, audioTrack]);

  // Update muted state
  useEffect(() => {
    if (vadManagerRef.current) {
      vadManagerRef.current.setMuted(isMuted);
    }
  }, [isMuted]);

  // Update threshold
  useEffect(() => {
    if (vadManagerRef.current) {
      vadManagerRef.current.setThreshold(speakingThreshold);
    }
  }, [speakingThreshold]);

  const startMicrophone = useCallback(async () => {
    if (!vadManagerRef.current) {
      vadManagerRef.current = new AudioVADManager({
        speakingThreshold,
        onVoiceActiveChange: (speaking, vol) => {
          setIsSpeaking(speaking);
          if (onVoiceActiveChange) {
            onVoiceActiveChange(speaking, vol);
          }
          if (sendWebSocketMessage) {
            sendWebSocketMessage({
              type: 'voice:active',
              isSpeaking: speaking,
              volume: vol,
              audioLevel: vol,
            });
          }
        },
        onVolumeChange: (vol) => {
          setVolume(vol);
        },
      });
    }

    const stream = await vadManagerRef.current.initializeWithMicrophone();
    return stream;
  }, [speakingThreshold, onVoiceActiveChange, sendWebSocketMessage]);

  const stopMicrophone = useCallback(() => {
    if (vadManagerRef.current) {
      vadManagerRef.current.cleanup();
    }
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  return {
    isSpeaking,
    volume,
    startMicrophone,
    stopMicrophone,
    vadManager: vadManagerRef.current,
  };
}

export default useVoiceActivity;
