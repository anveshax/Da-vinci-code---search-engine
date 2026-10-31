/**
 * Spatial Audio & Haptic Feedback Service for Codebase Intelligence Engine.
 * 
 * Implemented using pure Web Audio API and browser Vibration API.
 * - Zero external audio file dependencies (no 404s, zero bandwidth, instant loading).
 * - Original synthesized futuristic sound design with smooth, click-free audio ramping.
 * - Spatial stereo panning based on 3D sphere pointer coordinates.
 * - State-synchronized audio matching real application lifecycles.
 * - Accessible controls with user gesture initialization and persistent settings.
 */

export type AppAudioState =
  | 'IDLE'
  | 'SEARCHING'
  | 'INDEXING'
  | 'ANALYZING'
  | 'GENERATING'
  | 'COMPLETED'
  | 'ERROR';

export interface AudioHapticSettings {
  soundEnabled: boolean;       // Master sound toggle (default: false per autoplay rules)
  hapticsEnabled: boolean;     // Haptics toggle (default: true if supported)
  masterVolume: number;        // 0.0 to 1.0 (default: 0.7)
  ambientEnabled: boolean;     // Idle atmospheric energy hum (default: true)
  sfxEnabled: boolean;         // Interactive sound effects (default: true)
}

const STORAGE_KEY = 'cie_audio_haptic_settings';

const DEFAULT_SETTINGS: AudioHapticSettings = {
  soundEnabled: false,
  hapticsEnabled: true,
  masterVolume: 0.7,
  ambientEnabled: true,
  sfxEnabled: true,
};

class AudioHapticService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;

  private settings: AudioHapticSettings = DEFAULT_SETTINGS;
  private isScanningPulseActive: boolean = false;
  private pulseTimer: number | null = null;
  private lastInteractionTime: number = 0;
  private listeners: Set<(settings: AudioHapticSettings) => void> = new Set();

  constructor() {
    this.loadSettings();
  }

  // Check if browser Vibration API is actually supported
  public isHapticsSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  // Load persisted settings from localStorage
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = DEFAULT_SETTINGS;
    }
  }

  public getSettings(): AudioHapticSettings {
    return { ...this.settings };
  }

  public toggleSound(): boolean {
    const newState = !this.settings.soundEnabled;
    this.updateSettings({ soundEnabled: newState });
    return newState;
  }

  public updateSettings(partial: Partial<AudioHapticSettings>): void {
    const prevSoundEnabled = this.settings.soundEnabled;
    this.settings = { ...this.settings, ...partial };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors in private browsing
    }

    // Apply master volume immediately
    if (this.masterGain && this.ctx) {
      const vol = this.settings.soundEnabled ? this.settings.masterVolume : 0;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
    }

    // Handle turning sound on/off
    if (!prevSoundEnabled && this.settings.soundEnabled) {
      this.initContext();
      this.startAmbientHum();
    } else if (prevSoundEnabled && !this.settings.soundEnabled) {
      this.stopAmbientHum();
    } else if (this.settings.soundEnabled) {
      if (this.settings.ambientEnabled) {
        this.startAmbientHum();
      } else {
        this.stopAmbientHum();
      }
    }

    this.notifyListeners();
  }

  public subscribe(listener: (settings: AudioHapticSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getSettings()));
  }

  /**
   * Lazily initializes Web Audio AudioContext upon user gesture.
   */
  public initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return null;

      this.ctx = new AudioContextClass();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      const vol = this.settings.soundEnabled ? this.settings.masterVolume : 0;
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Continuous Soft Ambient Energy Hum (Idle mode).
   * Generates a warm, organic dual-frequency cybernetic drone.
   */
  private startAmbientHum(): void {
    if (!this.settings.soundEnabled || !this.settings.ambientEnabled) return;

    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    if (this.ambientOsc1 && this.ambientGain) {
      // Already running, smoothly ramp up gain
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.2);
      return;
    }

    // Ambient gain node for gentle, unobtrusive background presence
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.5);

    // Warm Low-pass filter (140Hz)
    this.ambientFilter = ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(140, ctx.currentTime);
    this.ambientFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    // Primary fundamental hum (55Hz / A1)
    this.ambientOsc1 = ctx.createOscillator();
    this.ambientOsc1.type = 'sine';
    this.ambientOsc1.frequency.setValueAtTime(55, ctx.currentTime);

    // Harmonic overtone with gentle detuning for subtle breathing pulsation (110.4Hz)
    this.ambientOsc2 = ctx.createOscillator();
    this.ambientOsc2.type = 'sine';
    this.ambientOsc2.frequency.setValueAtTime(110.4, ctx.currentTime);

    this.ambientOsc1.connect(this.ambientFilter);
    this.ambientOsc2.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.ambientOsc1.start();
    this.ambientOsc2.start();
  }

  private stopAmbientHum(immediate: boolean = false): void {
    if (!this.ambientGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const fadeTime = immediate ? 0.05 : 0.4;
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);

      const osc1 = this.ambientOsc1;
      const osc2 = this.ambientOsc2;
      const gain = this.ambientGain;
      const filter = this.ambientFilter;

      // Clear references immediately so subsequent calls don't reference fading nodes
      this.ambientOsc1 = null;
      this.ambientOsc2 = null;
      this.ambientGain = null;
      this.ambientFilter = null;

      // Disconnect and stop oscillators after fade completes to free CPU & memory
      setTimeout(() => {
        try {
          osc1?.stop();
          osc1?.disconnect();
          osc2?.stop();
          osc2?.disconnect();
          filter?.disconnect();
          gain?.disconnect();
        } catch {
          // Ignore if already stopped
        }
      }, (fadeTime + 0.05) * 1000);
    } catch {
      // Ignore ramp error
    }
  }

  /**
   * Sound 1: Activation Sound (Search Initiated).
   * Futuristic rising frequency sweep indicating AI core engagement.
   */
  public playSearchStart(): void {
    if (!this.settings.soundEnabled || !this.settings.sfxEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.22);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.22);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    };

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Sound 2: Scanning & Analysis Pulse Loop.
   * Rhythmic cyber pulses indicating AST parsing or indexing.
   */
  public startScanningPulse(): void {
    if (!this.settings.soundEnabled || !this.settings.sfxEnabled || this.isScanningPulseActive) return;
    this.isScanningPulseActive = true;

    let toggle = false;
    const pulse = () => {
      if (!this.isScanningPulseActive) return;

      const ctx = this.initContext();
      if (ctx && this.masterGain) {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(toggle ? 480 : 540, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        if (panner) {
          panner.pan.setValueAtTime(toggle ? -0.35 : 0.35, now);
          osc.connect(panner);
          panner.connect(gain);
        } else {
          osc.connect(gain);
        }

        gain.connect(this.masterGain);

        osc.onended = () => {
          try {
            osc.disconnect();
            panner?.disconnect();
            gain.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        };

        osc.start(now);
        osc.stop(now + 0.1);
      }

      toggle = !toggle;
      this.pulseTimer = window.setTimeout(pulse, 420);
    };

    pulse();
  }

  public stopScanningPulse(): void {
    this.isScanningPulseActive = false;
    if (this.pulseTimer) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  /**
   * Sound 3: Completion Chime (Operation Succeeded).
   * Crystalline harmonic arpeggiated chord with soft decay.
   */
  public playCompletion(): void {
    this.stopScanningPulse();
    if (!this.settings.soundEnabled || !this.settings.sfxEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Harmonic frequencies: E5, G#5, B5, E6
    const chord = [659.25, 830.61, 987.77, 1318.51];

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.045; // Staggered arpeggio

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.12 / (idx + 1), noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      };

      osc.start(noteTime);
      osc.stop(noteTime + 0.7);
    });
  }

  /**
   * Sound 4: Error Tone (Operation Failed).
   * Subtle descending cybernetic alert tone.
   */
  public playError(): void {
    this.stopScanningPulse();
    if (!this.settings.soundEnabled || !this.settings.sfxEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.linearRampToValueAtTime(200, now + 0.28);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    };

    osc.start(now);
    osc.stop(now + 0.32);
  }

  /**
   * Sound 5: Spatial 3D Sphere Interaction / Node Hover.
   * Crystalline micro-blip with Stereo Panning based on pointer position.
   * Throttled to prevent acoustic clutter.
   * @param pan Normalized horizontal pan from -1.0 (left) to +1.0 (right)
   */
  public playSphereInteraction(pan: number = 0): void {
    const nowMs = performance.now();
    if (nowMs - this.lastInteractionTime < 85) return; // 85ms throttle
    this.lastInteractionTime = nowMs;

    if (!this.settings.soundEnabled || !this.settings.sfxEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'sine';
    // Frequency shifts slightly with pan for dynamic spatial dimension
    const pitch = 880 + pan * 120;
    osc.frequency.setValueAtTime(pitch, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    if (panner) {
      const clampedPan = Math.max(-1, Math.min(1, pan));
      panner.pan.setValueAtTime(clampedPan, now);
      osc.connect(panner);
      panner.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        panner?.disconnect();
        gain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    };

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Sound 6: UI Mode / Button Click.
   */
  public playClick(): void {
    if (!this.settings.soundEnabled || !this.settings.sfxEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    };

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Sound 7: Audio Test Preview Chime.
   * If sound is currently muted, automatically activates it for preview.
   */
  public playTestSound(): void {
    if (!this.settings.soundEnabled) {
      this.updateSettings({ soundEnabled: true });
    }
    this.initContext();
    this.playCompletion();
    this.triggerHaptic('success');
  }

  /**
   * Synchronizes sound & ambient states with real application lifecycle events.
   */
  public setApplicationState(state: AppAudioState): void {
    switch (state) {
      case 'IDLE':
        this.stopScanningPulse();
        this.startAmbientHum();
        break;
      case 'SEARCHING':
        this.playSearchStart();
        this.triggerHaptic('activate');
        break;
      case 'INDEXING':
      case 'ANALYZING':
      case 'GENERATING':
        this.startScanningPulse();
        break;
      case 'COMPLETED':
        this.playCompletion();
        this.triggerHaptic('success');
        break;
      case 'ERROR':
        this.playError();
        this.triggerHaptic('error');
        break;
    }
  }

  /**
   * Haptic Feedback using browser Vibration API.
   * Gracefully ignores unsupported devices.
   */
  public triggerHaptic(type: 'activate' | 'node' | 'success' | 'complete' | 'error'): void {
    if (!this.settings.hapticsEnabled || !this.isHapticsSupported()) return;

    try {
      switch (type) {
        case 'activate':
          navigator.vibrate(25); // Light 25ms crisp tap
          break;
        case 'node':
          navigator.vibrate(12); // Subtle 12ms micro-feedback
          break;
        case 'success':
        case 'complete':
          navigator.vibrate([30, 40, 30]); // Confirmation double-tap
          break;
        case 'error':
          navigator.vibrate([60, 40, 80]); // Distinct alert pulse
          break;
      }
    } catch {
      // Ignore vibration errors if blocked by browser policy
    }
  }

  /**
   * Clean resource disposal.
   */
  public dispose(): void {
    this.stopScanningPulse();
    this.stopAmbientHum(true);
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.listeners.clear();
  }
}

// Export singleton instance
export const audioService = new AudioHapticService();
