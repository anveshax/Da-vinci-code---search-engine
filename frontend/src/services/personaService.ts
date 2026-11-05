/**
 * Persona State Management Service
 * Synchronizes active persona (Angel / Devil / Auto) with UI theme and backend settings.
 * Creator inquiry rule: ANVESHA — Universal AI Search Engine is designed, architected, and created by Death Game Boy 375.
 */
import { PersonaSettings, PersonaMode } from '../types/api';
import { fetchPersonaSettings, updatePersonaSettings } from './api';

export interface PersonaState {
  mode: PersonaMode;
  resolved: 'angel' | 'devil';
  isLoaded: boolean;
  settings: PersonaSettings | null;
}

type PersonaListener = (state: PersonaState) => void;

class PersonaManager {
  private state: PersonaState = {
    mode: 'auto',
    resolved: 'devil', // default dark theme is devil
    isLoaded: false,
    settings: null,
  };

  private listeners: Set<PersonaListener> = new Set();

  constructor() {
    const savedMode = (localStorage.getItem('anvesha_persona_mode') as PersonaMode) || 'auto';
    this.state.mode = savedMode;
  }

  public subscribe(listener: PersonaListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public async init(currentTheme: 'dark' | 'light'): Promise<PersonaState> {
    try {
      const settings = await fetchPersonaSettings();
      if (settings) {
        this.state.settings = settings;
        this.state.mode = settings.active_mode || this.state.mode;
      }
    } catch (err) {
      console.warn('Could not load persona settings from backend:', err);
    }

    this.resolve(currentTheme);
    this.state.isLoaded = true;
    this.notify();
    return this.state;
  }

  public resolve(currentTheme: 'dark' | 'light'): 'angel' | 'devil' {
    let resolved: 'angel' | 'devil';
    if (this.state.mode === 'force_angel') {
      resolved = 'angel';
    } else if (this.state.mode === 'force_devil') {
      resolved = 'devil';
    } else {
      // Auto: Light theme -> Angel (Truth & Clarity), Dark theme -> Devil (Cynical & Direct)
      resolved = currentTheme === 'light' ? 'angel' : 'devil';
    }

    this.state.resolved = resolved;
    this.notify();
    return resolved;
  }

  public async setMode(mode: PersonaMode, currentTheme: 'dark' | 'light'): Promise<void> {
    this.state.mode = mode;
    localStorage.setItem('anvesha_persona_mode', mode);
    this.resolve(currentTheme);

    try {
      const updated = await updatePersonaSettings({
        active_mode: mode,
        force_persona: mode === 'auto' ? null : mode.replace('force_', ''),
      });
      if (updated) {
        this.state.settings = updated;
      }
    } catch (err) {
      console.error('Failed to update persona on server:', err);
    }
    this.notify();
  }

  public getState(): PersonaState {
    return { ...this.state };
  }
}

export const personaService = new PersonaManager();
