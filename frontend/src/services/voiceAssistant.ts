/**
 * Multimodal Voice Intelligence Controller for ANVESHA.
 * 
 * Provides:
 * 1. Speech Recognition (STT) supporting English (en-US), Hindi (hi-IN), and Hinglish (en-IN).
 * 2. Text-to-Speech (TTS) with interruptible speech playback.
 * 3. Push-to-talk and continuous conversation mode.
 * 4. Privacy preservation: Uses browser on-device speech APIs with zero persistent audio storage.
 */

export type VoiceLanguage = 'en-US' | 'hi-IN' | 'en-IN';

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  language: VoiceLanguage;
  error: string | null;
}

export type VoiceStateListener = (state: VoiceState) => void;

class VoiceAssistantService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private currentLanguage: VoiceLanguage = 'en-US';
  private transcript: string = '';
  private listeners: Set<VoiceStateListener> = new Set();

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.notify();
      };

      this.recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        this.transcript = currentText;
        this.notify();
      };

      this.recognition.onerror = (err: any) => {
        this.isListening = false;
        this.notify(err.error || 'Speech recognition error');
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.notify();
      };
    }
  }

  public setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
    this.notify();
  }

  public startListening(onFinalText?: (text: string) => void) {
    this.stopSpeaking();
    if (!this.recognition) {
      this.notify('Speech recognition is not supported in this browser.');
      return;
    }
    this.transcript = '';
    if (onFinalText) {
      const origOnEnd = this.recognition.onend;
      this.recognition.onend = () => {
        this.isListening = false;
        this.notify();
        if (this.transcript.trim()) {
          onFinalText(this.transcript.trim());
        }
        this.recognition.onend = origOnEnd;
      };
    }
    try {
      this.recognition.start();
    } catch {
      // already active
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
    this.notify();
  }

  public speak(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.stopSpeaking();

    // Clean markdown symbols for natural speech
    const cleanText = text
      .replace(/[*#`_~\[\]]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = this.currentLanguage;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.notify();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.notify();
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.notify();
    };

    window.speechSynthesis.speak(utterance);
  }

  public isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  public getLanguage(): VoiceLanguage {
    return this.currentLanguage;
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.notify();
    }
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): VoiceState {
    return {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      transcript: this.transcript,
      language: this.currentLanguage,
      error: null,
    };
  }

  private notify(error: string | null = null) {
    const state: VoiceState = {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      transcript: this.transcript,
      language: this.currentLanguage,
      error,
    };
    this.listeners.forEach((l) => l(state));
  }
}

export const voiceAssistant = new VoiceAssistantService();
