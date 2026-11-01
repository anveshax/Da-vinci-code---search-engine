import * as THREE from 'three';

export type GlobeColorPreset =
  | 'ice_blue'
  | 'electric_blue'
  | 'white'
  | 'cyan'
  | 'purple'
  | 'gold'
  | 'custom';

export type GlobeStyle = 'realistic' | 'classic' | 'holographic' | 'cinematic' | 'v1' | 'v2' | 'v3' | 'v4';

export interface GlobeVersionInfo {
  id: 'classic' | 'realistic' | 'holographic' | 'cinematic';
  code: 'V1' | 'V2' | 'V3' | 'V4';
  name: string;
  badge: string;
  description: string;
}

export const GLOBE_VERSIONS: GlobeVersionInfo[] = [
  {
    id: 'classic',
    code: 'V1',
    name: 'Classic Minimal',
    badge: 'Option 2 (V1)',
    description: 'Original Three.js dot-matrix Earth with 3D sphere halo nodes, sharp continent points, and radial ground mist.',
  },
  {
    id: 'realistic',
    code: 'V2',
    name: 'Realistic Immersive',
    badge: 'Option 1 (V2 Default)',
    description: 'High-fidelity dark Earth matching approved reference with starlight particle cloud, starburst flare satellite nodes, and glossy studio floor reflection.',
  },
  {
    id: 'holographic',
    code: 'V3',
    name: 'Holographic Particle Earth',
    badge: 'Option 3 (V3)',
    description: 'Cinematic digital point-cloud Earth with intercontinental data connection arcs, luminous satellite cross-flares, three inclined orbital rings, and dark transparent depth.',
  },
  {
    id: 'cinematic',
    code: 'V4',
    name: 'Cinematic Orbit Earth',
    badge: 'Option 4 (V4)',
    description: 'Americas-centered Earth with 6 luminous starburst satellite nodes, multi-angle orbital rings, and deep cosmos styling directly matching the reference visual.',
  },
];

export function normalizeGlobeStyle(style?: GlobeStyle): 'classic' | 'realistic' | 'holographic' | 'cinematic' {
  if (style === 'v1' || style === 'classic') return 'classic';
  if (style === 'v3' || style === 'holographic') return 'holographic';
  if (style === 'v4' || style === 'cinematic') return 'cinematic';
  return 'realistic';
}

export interface GlobeColorPalette {
  primary: string;        // Continents / main city lights
  secondary: string;      // Subtle mid-tones
  rim: string;            // Atmospheric rim glow
  orbit: string;          // Orbit paths
  nodeFlare: string;      // Orbital node blooms
  floor: string;          // Ground reflection
  ambientBackdrop: string;// Atmospheric gradient
}

export interface GlobeSettings {
  globeStyle: GlobeStyle;        // 'realistic' (default) | 'classic'
  lightIntensity: number;        // 0.2 to 2.0 (default 1.0)
  atmosphericGlow: number;       // 0.0 to 2.0 (default 1.0)
  ambientBrightness: number;     // 0.0 to 2.0 (default 0.85)
  surfaceIllumination: number;   // 0.2 to 2.0 (default 1.0)
  orbitalLightIntensity: number; // 0.2 to 2.0 (default 1.0)
  colorPreset: GlobeColorPreset;
  customColor: string;           // Hex color string (default '#a0c4ff')
}

const STORAGE_KEY = 'anvesha_globe_lighting_settings';

export const DEFAULT_GLOBE_SETTINGS: GlobeSettings = {
  globeStyle: 'realistic',
  lightIntensity: 1.0,
  atmosphericGlow: 1.0,
  ambientBrightness: 0.85,
  surfaceIllumination: 1.0,
  orbitalLightIntensity: 1.0,
  colorPreset: 'ice_blue',
  customColor: '#a0c4ff',
};

export const COLOR_PRESET_CONFIGS: Record<
  Exclude<GlobeColorPreset, 'custom'>,
  GlobeColorPalette
> = {
  ice_blue: {
    primary: '#ffffff',
    secondary: '#a0c4ff',
    rim: '#c0d8ff',
    orbit: '#d8e6ff',
    nodeFlare: '#8ab4f8',
    floor: '#7094d4',
    ambientBackdrop: 'rgba(138, 180, 248, 0.14)',
  },
  electric_blue: {
    primary: '#93c5fd',
    secondary: '#3b82f6',
    rim: '#60a5fa',
    orbit: '#bfdbfe',
    nodeFlare: '#2563eb',
    floor: '#1d4ed8',
    ambientBackdrop: 'rgba(59, 130, 246, 0.16)',
  },
  white: {
    primary: '#ffffff',
    secondary: '#cbd5e1',
    rim: '#f8fafc',
    orbit: '#ffffff',
    nodeFlare: '#e2e8f0',
    floor: '#94a3b8',
    ambientBackdrop: 'rgba(255, 255, 255, 0.12)',
  },
  cyan: {
    primary: '#e0f2fe',
    secondary: '#06b6d4',
    rim: '#22d3ee',
    orbit: '#a5f3fc',
    nodeFlare: '#00f0ff',
    floor: '#0891b2',
    ambientBackdrop: 'rgba(6, 182, 212, 0.15)',
  },
  purple: {
    primary: '#f3e8ff',
    secondary: '#a855f7',
    rim: '#c084fc',
    orbit: '#e9d5ff',
    nodeFlare: '#9333ea',
    floor: '#7e22ce',
    ambientBackdrop: 'rgba(168, 85, 247, 0.14)',
  },
  gold: {
    primary: '#fef9c3',
    secondary: '#eab308',
    rim: '#facc15',
    orbit: '#fef08a',
    nodeFlare: '#ca8a04',
    floor: '#a16207',
    ambientBackdrop: 'rgba(234, 179, 8, 0.14)',
  },
};

export function getPaletteForCustomColor(hex: string): GlobeColorPalette {
  try {
    const base = new THREE.Color(hex);
    const lighter = base.clone().lerp(new THREE.Color(0xffffff), 0.6);
    const darker = base.clone().multiplyScalar(0.7);
    const rim = base.clone().lerp(new THREE.Color(0xffffff), 0.4);

    return {
      primary: '#ffffff',
      secondary: '#' + base.getHexString(),
      rim: '#' + rim.getHexString(),
      orbit: '#' + lighter.getHexString(),
      nodeFlare: '#' + base.getHexString(),
      floor: '#' + darker.getHexString(),
      ambientBackdrop: `rgba(${Math.round(base.r * 255)}, ${Math.round(base.g * 255)}, ${Math.round(base.b * 255)}, 0.15)`,
    };
  } catch {
    return COLOR_PRESET_CONFIGS.ice_blue;
  }
}

export function resolvePalette(settings: GlobeSettings): GlobeColorPalette {
  if (settings.colorPreset === 'custom') {
    return getPaletteForCustomColor(settings.customColor || '#a0c4ff');
  }
  return COLOR_PRESET_CONFIGS[settings.colorPreset] || COLOR_PRESET_CONFIGS.ice_blue;
}

class GlobeSettingsService {
  private settings: GlobeSettings = DEFAULT_GLOBE_SETTINGS;
  private listeners: Set<(settings: GlobeSettings) => void> = new Set();

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = {
          ...DEFAULT_GLOBE_SETTINGS,
          ...parsed,
        };
      }
      // Optional URL parameter override for direct testing / preview
      if (window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const style = params.get('globeStyle');
        if (
          style === 'classic' ||
          style === 'realistic' ||
          style === 'holographic' ||
          style === 'cinematic' ||
          style === 'v1' ||
          style === 'v2' ||
          style === 'v3' ||
          style === 'v4'
        ) {
          this.settings.globeStyle = style as GlobeStyle;
        }
      }
    } catch (err) {
      console.warn('Could not load globe settings from localStorage:', err);
      this.settings = { ...DEFAULT_GLOBE_SETTINGS };
    }
  }

  public getSettings(): GlobeSettings {
    return { ...this.settings };
  }

  public getPalette(): GlobeColorPalette {
    return resolvePalette(this.settings);
  }

  public updateSettings(partial: Partial<GlobeSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.saveSettings();
    this.notify();
  }

  public resetToDefault(): void {
    this.settings = { ...DEFAULT_GLOBE_SETTINGS };
    this.saveSettings();
    this.notify();
  }

  public subscribe(callback: (settings: GlobeSettings) => void): () => void {
    this.listeners.add(callback);
    callback(this.getSettings());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      console.warn('Failed to persist globe settings:', err);
    }
  }

  private notify(): void {
    const current = this.getSettings();
    this.listeners.forEach((cb) => {
      try {
        cb(current);
      } catch (err) {
        console.error('Error in globe settings listener:', err);
      }
    });
  }
}

export const globeSettingsService = new GlobeSettingsService();
