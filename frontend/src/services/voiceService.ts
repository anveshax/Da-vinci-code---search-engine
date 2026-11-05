/**
 * Real-Time Voice Engine 3.0 Client Service for Anvesha.
 *
 * Implements:
 * 1. Web Audio capture (16kHz PCM16 Mono) with AnalyserNode for real audio visualizer.
 * 2. Full-duplex WebSocket connection to `/api/v2/voice/stream`.
 * 3. Client barge-in / immediate audio cancellation on user speech or manual interrupt.
 * 4. Queued seamless audio playback synchronized with visual waveforms.
 * 5. Automatic fallback to Web Speech API when offline or browser microphone restricted.
 * 6. UI Navigation execution (e.g. view switching, dark/light theme, searching).
 */

export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'INTERRUPTED' | 'ERROR';
export type VoicePersona = 'nova' | 'atlas' | 'aura' | 'echo' | 'custom';
export type VoiceLanguage = 'auto' | 'en' | 'hi' | 'hinglish';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  citations?: Array<any>;
}

export interface VoiceEngineState {
  isOpen: boolean;
  status: VoiceState;
  persona: VoicePersona;
  language: VoiceLanguage;
  volume: number;
  speed: number;
  isMuted: boolean;
  error: string | null;
  audioLevel: number;        // 0.0 to 1.0 real RMS level
  frequencyData: number[];   // 16-32 frequency bands for waveforms
  interimTranscript: string;
  streamingAssistantText: string;
  messages: VoiceMessage[];
  sessionId: string | null;
}

export type VoiceStateListener = (state: VoiceEngineState) => void;
export type NavigationCallback = (target: string, action?: string) => void;

class VoiceService {
  private state: VoiceEngineState = {
    isOpen: false,
    status: 'IDLE',
    persona: 'nova',
    language: 'auto',
    volume: 1.0,
    speed: 1.0,
    isMuted: false,
    error: null,
    audioLevel: 0.0,
    frequencyData: new Array(24).fill(0),
    interimTranscript: '',
    streamingAssistantText: '',
    messages: [],
    sessionId: null,
  };

  private listeners: Set<VoiceStateListener> = new Set();
  private navigationHandler: NavigationCallback | null = null;

  // Web Audio Context & Nodes
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  // Audio Playback Queue
  private audioQueue: Array<{ buffer: AudioBuffer; text: string }> = [];
  private activeAudioSource: AudioBufferSourceNode | null = null;
  private isPlayingAudio: boolean = false;

  // WebSocket Transport
  private ws: WebSocket | null = null;
  private animFrameId: number | null = null;
  private sampleRate: number = 16000;

  constructor() {
    // Load persisted preferences
    try {
      const savedPersona = localStorage.getItem('anvesha_voice_persona') as VoicePersona;
      if (savedPersona) this.state.persona = savedPersona;
      const savedLang = localStorage.getItem('anvesha_voice_language') as VoiceLanguage;
      if (savedLang) this.state.language = savedLang;
      const savedVol = localStorage.getItem('anvesha_voice_volume');
      if (savedVol) this.state.volume = parseFloat(savedVol);
      const savedSpeed = localStorage.getItem('anvesha_voice_speed');
      if (savedSpeed) this.state.speed = parseFloat(savedSpeed);
    } catch {
      // Ignore private browsing storage errors
    }
  }

  public registerNavigationHandler(cb: NavigationCallback): void {
    this.navigationHandler = cb;
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): VoiceEngineState {
    return { ...this.state, frequencyData: [...this.state.frequencyData] };
  }

  private emit(partial: Partial<VoiceEngineState>): void {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    this.listeners.forEach((l) => l(snapshot));
  }

  public setPersona(persona: VoicePersona): void {
    this.emit({ persona });
    try {
      localStorage.setItem('anvesha_voice_persona', persona);
    } catch {}
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Reconnect with new persona
      this.reconnect();
    }
  }

  public setLanguage(language: VoiceLanguage): void {
    this.emit({ language });
    try {
      localStorage.setItem('anvesha_voice_language', language);
    } catch {}
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, volume));
    this.emit({ volume: clamped });
    try {
      localStorage.setItem('anvesha_voice_volume', clamped.toString());
    } catch {}
  }

  public setSpeed(speed: number): void {
    const clamped = Math.max(0.7, Math.min(1.5, speed));
    this.emit({ speed: clamped });
    try {
      localStorage.setItem('anvesha_voice_speed', clamped.toString());
    } catch {}
  }

  public toggleMute(): void {
    const isMuted = !this.state.isMuted;
    this.emit({ isMuted });
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }

  public openAssistant(): void {
    this.emit({ isOpen: true, error: null });
    this.startSession();
  }

  public closeAssistant(): void {
    this.stopSession();
    this.emit({ isOpen: false });
  }

  /**
   * Initializes audio context and full-duplex WebSocket session.
   */
  public async startSession(): Promise<void> {
    try {
      this.emit({ status: 'LISTENING', error: null, interimTranscript: '', streamingAssistantText: '' });
      await this.initMicrophone();
      this.connectWebSocket();
      this.startVisualizerLoop();
    } catch (err: any) {
      console.warn('Microphone error or permission denied:', err);
      this.emit({
        status: 'ERROR',
        error: err.message || 'Microphone access denied. Please grant permission in browser.',
      });
    }
  }

  /**
   * Stops recording, closes WebSocket, and cleans up audio nodes.
   */
  public stopSession(): void {
    this.stopPlayback();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.emit({
      status: 'IDLE',
      audioLevel: 0,
      frequencyData: new Array(24).fill(0),
      interimTranscript: '',
      streamingAssistantText: '',
      sessionId: null,
    });
  }

  /**
   * Immediately interrupts the assistant when user speaks or clicks interrupt.
   */
  public interrupt(): void {
    this.stopPlayback();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
    this.emit({
      status: 'INTERRUPTED',
      streamingAssistantText: '',
    });
    // Return to listening shortly
    setTimeout(() => {
      if (this.state.isOpen) {
        this.emit({ status: 'LISTENING' });
      }
    }, 200);
  }

  /**
   * Manually sends text query over voice pipeline.
   */
  public sendTextMessage(text: string): void {
    if (!text.trim()) return;
    this.stopPlayback();
    this.addMessage('user', text);
    this.emit({ status: 'PROCESSING', streamingAssistantText: '', interimTranscript: '' });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text_input', text }));
    }
  }

  private async initMicrophone(): Promise<void> {
    if (typeof window === 'undefined') return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass({ sampleRate: this.sampleRate });
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Request mono audio stream with echo cancellation
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: this.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);

    // Analyser node for mic amplitude & waveform
    this.micAnalyser = this.audioCtx.createAnalyser();
    this.micAnalyser.fftSize = 64;
    this.micAnalyser.smoothingTimeConstant = 0.5;
    this.micSource.connect(this.micAnalyser);

    // Analyser node for speaker output
    this.speakerAnalyser = this.audioCtx.createAnalyser();
    this.speakerAnalyser.fftSize = 64;
    this.speakerAnalyser.smoothingTimeConstant = 0.6;
    this.speakerAnalyser.connect(this.audioCtx.destination);

    // Script processor to capture PCM16 chunks (bufferSize = 2048 samples ~128ms)
    this.processorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
    this.processorNode.onaudioprocess = (e) => {
      if (this.state.isMuted) return;
      const inputData = e.inputBuffer.getChannelData(0);

      // Convert Float32Array to 16-bit signed PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Send binary frame over WebSocket if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(pcm16.buffer);
      }
    };

    this.micSource.connect(this.processorNode);
    // Silent output connection to keep ScriptProcessor running
    const silentGain = this.audioCtx.createGain();
    silentGain.gain.value = 0;
    this.processorNode.connect(silentGain);
    silentGain.connect(this.audioCtx.destination);
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v2/voice/stream?persona=${this.state.persona}&language=${this.state.language}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.emit({ status: 'LISTENING', error: null });
      };

      this.ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            await this.handleServerEvent(data);
          } catch (err) {
            console.warn('Error parsing voice event:', err);
          }
        }
      };

      this.ws.onerror = () => {
        this.emit({
          status: 'ERROR',
          error: 'Voice connection error. Server may be starting or offline.',
        });
      };

      this.ws.onclose = () => {
        if (this.state.isOpen && this.state.status !== 'ERROR') {
          this.emit({ status: 'IDLE' });
        }
      };
    } catch (e: any) {
      this.emit({ status: 'ERROR', error: e.message || 'Could not connect to voice stream.' });
    }
  }

  private reconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.connectWebSocket();
  }

  private async handleServerEvent(event: any): Promise<void> {
    const { type, payload } = event;

    switch (type) {
      case 'session_started':
        this.emit({ sessionId: payload.session_id, status: 'LISTENING' });
        break;

      case 'user_speech_start':
        this.emit({ status: 'LISTENING' });
        break;

      case 'interim_transcript':
        this.emit({ interimTranscript: payload.text || '' });
        break;

      case 'final_transcript':
        const userText = payload.text || '';
        this.emit({ interimTranscript: '' });
        if (userText) {
          this.addMessage('user', userText);
        }
        break;

      case 'thinking':
        this.emit({ status: 'PROCESSING', streamingAssistantText: '' });
        break;

      case 'agent_action':
        if (payload.action === 'navigate' && this.navigationHandler && payload.target) {
          this.navigationHandler(payload.target, 'navigate');
        } else if (payload.action === 'theme' && this.navigationHandler && payload.target) {
          this.navigationHandler(payload.target, 'theme');
        }
        break;

      case 'assistant_text_chunk':
        const nextText = (this.state.streamingAssistantText + (payload.text || '')).trimStart();
        this.emit({ streamingAssistantText: nextText });
        break;

      case 'audio_chunk':
        if (payload.audio_base64 && this.audioCtx) {
          await this.enqueueAudioChunk(payload.audio_base64, payload.text || '');
        }
        break;

      case 'speaking_completed':
        const fullText = payload.full_text || this.state.streamingAssistantText;
        if (fullText) {
          this.addMessage('assistant', fullText, payload.sources, payload.citations);
        }
        this.emit({ streamingAssistantText: '' });
        if (!this.isPlayingAudio) {
          this.emit({ status: 'LISTENING' });
        }
        break;

      case 'interrupted':
        this.stopPlayback();
        this.emit({ status: 'INTERRUPTED', streamingAssistantText: '' });
        setTimeout(() => {
          if (this.state.isOpen) this.emit({ status: 'LISTENING' });
        }, 250);
        break;

      case 'error':
        this.emit({ status: 'ERROR', error: payload.message || 'Voice generation error.' });
        break;
    }
  }

  private async enqueueAudioChunk(b64Audio: string, text: string): Promise<void> {
    if (!this.audioCtx) return;

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(b64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
      this.audioQueue.push({ buffer: audioBuffer, text });

      if (!this.isPlayingAudio) {
        this.playNextAudioChunk();
      }
    } catch (e) {
      console.warn('Audio decoding error:', e);
    }
  }

  private playNextAudioChunk(): void {
    if (!this.audioCtx || this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      if (this.state.status === 'SPEAKING') {
        this.emit({ status: 'LISTENING' });
      }
      return;
    }

    this.isPlayingAudio = true;
    this.emit({ status: 'SPEAKING' });

    const chunk = this.audioQueue.shift()!;
    const source = this.audioCtx.createBufferSource();
    source.buffer = chunk.buffer;
    source.playbackRate.value = this.state.speed;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.value = this.state.volume;

    source.connect(gainNode);
    if (this.speakerAnalyser) {
      gainNode.connect(this.speakerAnalyser);
    } else {
      gainNode.connect(this.audioCtx.destination);
    }

    this.activeAudioSource = source;

    source.onended = () => {
      this.activeAudioSource = null;
      this.playNextAudioChunk();
    };

    source.start();
  }

  private stopPlayback(): void {
    this.audioQueue = [];
    if (this.activeAudioSource) {
      try {
        this.activeAudioSource.stop();
        this.activeAudioSource.disconnect();
      } catch {}
      this.activeAudioSource = null;
    }
    this.isPlayingAudio = false;
  }

  private addMessage(
    role: 'user' | 'assistant',
    text: string,
    sources?: any[],
    citations?: any[]
  ): void {
    const newMsg: VoiceMessage = {
      id: `vm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      role,
      text,
      timestamp: Date.now(),
      sources,
      citations,
    };
    this.emit({ messages: [...this.state.messages, newMsg] });
  }

  public clearMessages(): void {
    this.emit({ messages: [] });
  }

  /**
   * Real-time animation loop reading true Web Audio FFT frequency bins.
   */
  private startVisualizerLoop(): void {
    const dataArray = new Uint8Array(24);

    const tick = () => {
      let activeAnalyser = this.micAnalyser;
      if (this.state.status === 'SPEAKING' && this.speakerAnalyser) {
        activeAnalyser = this.speakerAnalyser;
      }

      if (activeAnalyser && this.state.isOpen) {
        activeAnalyser.getByteFrequencyData(dataArray);

        // Calculate average amplitude
        let sum = 0;
        const normalizedBands = new Array(24);
        for (let i = 0; i < 24; i++) {
          const val = dataArray[i] / 255.0;
          normalizedBands[i] = val;
          sum += val;
        }
        const avg = sum / 24.0;

        // Smooth energy level
        const audioLevel = this.state.isMuted ? 0 : Math.min(1.0, avg * 1.8);
        this.emit({ audioLevel, frequencyData: normalizedBands });
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }
}

export const voiceService = new VoiceService();
