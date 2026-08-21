import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Radio, Sparkles, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface ChatMicButtonProps {
  onTranscript: (text: string, isFinal?: boolean) => void;
  disabled?: boolean;
  className?: string;
  lang?: string;
  placeholder?: string;
}

export const ChatMicButton: React.FC<ChatMicButtonProps> = ({
  onTranscript,
  disabled = false,
  className = '',
  lang = 'ru-RU',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('Остановлено');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef<boolean>(false);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
    }
  }, []);

  // Initialize and clean up recognition instance
  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop error if already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setStatusMessage('Остановлено');
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setErrorMessage('Web Speech API не поддерживается в этом браузере.');
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      stopListening();
    }

    try {
      isManuallyStoppedRef.current = false;
      setErrorMessage(null);

      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Слушаю... Говорите');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const recognizedText = (finalTranscript || interimTranscript).trim();
        if (recognizedText) {
          onTranscript(recognizedText, Boolean(finalTranscript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[ChatMicButton] SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setErrorMessage('Доступ к микрофону заблокирован в настройках браузера.');
          stopListening();
        } else if (event.error === 'no-speech') {
          setStatusMessage('Речь не обнаружена...');
        } else if (event.error === 'network') {
          setErrorMessage('Ошибка сети для распознавания речи.');
          stopListening();
        }
      };

      recognition.onend = () => {
        if (!isManuallyStoppedRef.current && isListening) {
          // Attempt restart if still intended to be listening
          try {
            recognition.start();
            return;
          } catch {}
        }
        setIsListening(false);
        setStatusMessage('Остановлено');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('[ChatMicButton] Failed to start SpeechRecognition:', err);
      setErrorMessage('Не удалось запустить микрофон.');
      setIsListening(false);
      setStatusMessage('Ошибка');
    }
  }, [lang, onTranscript, stopListening, isListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isManuallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      alert('Ваш браузер не поддерживает распознавание речи Web Speech API. Рекомендуется использовать Chrome, Edge, Safari или Яндекс.Браузер.');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Speech Active Status Tooltip / Badge */}
      {isListening && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/95 border border-rose-500/60 rounded-xl text-white shadow-2xl shadow-rose-950/60 whitespace-nowrap animate-fade-in backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="text-[11px] font-bold text-rose-300 font-mono flex items-center gap-1">
            Говорите...
          </span>
          
          {/* Animated sound wave bars */}
          <div className="flex items-center gap-0.5 ml-1 h-3">
            <span className="w-0.5 bg-rose-400 rounded-full h-2 animate-pulse" />
            <span className="w-0.5 bg-rose-300 rounded-full h-3 animate-bounce" />
            <span className="w-0.5 bg-rose-400 rounded-full h-1.5 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error Tooltip */}
      {errorMessage && (
        <div className="absolute bottom-full mb-2 right-0 z-30 max-w-xs p-2 bg-zinc-950 border border-amber-500/50 rounded-xl text-amber-300 text-[10px] shadow-xl flex items-center gap-1.5 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{errorMessage}</span>
          <button 
            type="button" 
            onClick={() => setErrorMessage(null)} 
            className="ml-1 text-zinc-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Microphone Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          !isSupported
            ? 'Web Speech API не поддерживается в этом браузере'
            : isListening
            ? 'Остановить распознавание речи (Слушаю...)'
            : 'Голосовой ввод: нажмите и говорите (Web Speech API)'
        }
        className={`relative px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center cursor-pointer select-none active:scale-95 ${
          !isSupported
            ? 'bg-zinc-900/60 border border-zinc-800 text-zinc-600 cursor-not-allowed'
            : isListening
            ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-red-600 text-white border border-rose-400 shadow-lg shadow-rose-600/40 ring-2 ring-rose-500/50 animate-pulse'
            : 'bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 text-purple-300 hover:text-white border border-purple-500/40 hover:border-pink-400/80 shadow-md'
        } ${className}`}
      >
        {/* Pulsing Ripple Background when Active */}
        {isListening && (
          <span className="absolute inset-0 rounded-xl bg-rose-500/30 animate-ping pointer-events-none" />
        )}

        <div className="relative flex items-center gap-1.5">
          {isListening ? (
            <Radio className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Mic className="w-4 h-4 transition-transform group-hover:scale-110" />
          )}

          <span className="hidden sm:inline text-[11px] font-mono font-bold tracking-tight">
            {isListening ? 'Слушаю...' : 'Голос'}
          </span>
        </div>
      </button>
    </div>
  );
};

export default ChatMicButton;
