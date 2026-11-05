import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Globe, Sparkles, AlertCircle } from 'lucide-react';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({ isOpen, onClose, onSearch }) => {
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'hi-IN' | 'en-IN'>('en-US');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimTranscript('');
      setErrorMessage(null);
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [isOpen, language]);

  const startListening = async () => {
    setErrorMessage(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Speech Recognition is not supported by your browser. Please try Chrome, Edge, or Brave.');
      return;
    }

    // Initialize Web Audio API for authentic volume level meter
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err: any) {
      console.warn('Microphone audio stream error:', err);
    }

    // Initialize Web Speech Recognition
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setTranscript(final);
          // Automatically trigger search after brief pause
          setTimeout(() => {
            onSearch(final);
            onClose();
          }, 800);
        } else {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
        } else if (event.error !== 'no-speech') {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setErrorMessage(`Failed to start speech recognition: ${err.message}`);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setIsListening(false);
    setAudioLevel(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0b0e17] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white tracking-wider font-mono">
              ANVESHA VOICE SEARCH 3.0
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Central Orb / Pulse Visualizer */}
        <div className="flex flex-col items-center justify-center py-10">
          <div className="relative flex items-center justify-center">
            {/* Animated Audio Level Ripple */}
            <div
              className="absolute rounded-full bg-cyan-500/20 transition-all duration-75"
              style={{
                width: `${100 + audioLevel * 1.5}px`,
                height: `${100 + audioLevel * 1.5}px`,
              }}
            />
            <div
              className="absolute rounded-full bg-cyan-400/30 transition-all duration-75"
              style={{
                width: `${80 + audioLevel * 0.8}px`,
                height: `${80 + audioLevel * 0.8}px`,
              }}
            />

            {/* Mic Center Button */}
            <button
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
                isListening
                  ? 'bg-cyan-500 text-white shadow-cyan-500/50 hover:bg-cyan-400'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {isListening ? (
                <Mic className="w-8 h-8 animate-pulse text-black" />
              ) : (
                <MicOff className="w-8 h-8 text-slate-400" />
              )}
            </button>
          </div>

          {/* Real Audio Wave Bars */}
          <div className="flex items-center justify-center gap-1.5 mt-8 h-10 w-48">
            {Array.from({ length: 12 }).map((_, idx) => {
              const barHeight = isListening ? Math.max(4, (audioLevel * ((idx % 4) + 1)) / 4) : 4;
              return (
                <div
                  key={idx}
                  className="w-1.5 bg-gradient-to-t from-cyan-500 to-sky-300 rounded-full transition-all duration-75"
                  style={{ height: `${Math.min(36, barHeight)}px` }}
                />
              );
            })}
          </div>

          {/* Transcript Display */}
          <div className="mt-6 text-center min-h-[4rem] px-4">
            {transcript ? (
              <p className="text-lg font-medium text-white">{transcript}</p>
            ) : interimTranscript ? (
              <p className="text-base text-cyan-300 italic">{interimTranscript}...</p>
            ) : (
              <p className="text-sm text-slate-400">
                {isListening ? 'Listening... Speak your query clearly.' : 'Tap the microphone to begin.'}
              </p>
            )}

            {errorMessage && (
              <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Language Selector & Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-[#101626] border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-cyan-400"
            >
              <option value="en-US">English (US / Global)</option>
              <option value="en-IN">Hinglish / Indian English</option>
              <option value="hi-IN">Hindi (हिंदी)</option>
            </select>
          </div>

          {transcript && (
            <button
              onClick={() => {
                onSearch(transcript);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Search Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
