import React from 'react';
import { Sparkles, Shield, Heart, Zap, Sliders, Check } from 'lucide-react';
import { VoicePersona } from '../../services/voiceService';

interface VoicePersonaSelectorProps {
  selectedPersona: VoicePersona;
  onSelectPersona: (persona: VoicePersona) => void;
}

interface PersonaCard {
  id: VoicePersona;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  color: string;
  icon: React.ReactNode;
}

const PERSONAS: PersonaCard[] = [
  {
    id: 'nova',
    name: 'Nova',
    tagline: 'Natural & Friendly',
    description: 'Warm, conversational tone for everyday questions, browsing, and summaries.',
    badge: 'Popular',
    color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'atlas',
    name: 'Atlas',
    tagline: 'Professional & Confident',
    description: 'Structured, authoritative explanations for architecture, research, and code.',
    badge: 'Technical',
    color: 'from-indigo-500/20 to-sky-500/10 border-indigo-500/30 text-indigo-300',
    icon: <Shield className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'aura',
    name: 'Aura',
    tagline: 'Calm & Warm',
    description: 'Patient, gentle cadence for learning complex topics and relaxed interaction.',
    badge: 'Mindful',
    color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300',
    icon: <Heart className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'echo',
    name: 'Echo',
    tagline: 'Concise & Neutral',
    description: 'High-density, rapid facts and status updates with zero conversational filler.',
    badge: 'Fast',
    color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-300',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'custom',
    name: 'Custom',
    tagline: 'User-Configured',
    description: 'Tailored tone and speech rate configured to your preferences.',
    badge: 'Tuned',
    color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-300',
    icon: <Sliders className="w-4 h-4 text-purple-400" />,
  },
];

export const VoicePersonaSelector: React.FC<VoicePersonaSelectorProps> = ({
  selectedPersona,
  onSelectPersona,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
      {PERSONAS.map((p) => {
        const isSelected = selectedPersona === p.id;
        return (
          <div
            key={p.id}
            onClick={() => onSelectPersona(p.id)}
            className={`relative p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 ${
              isSelected
                ? `bg-gradient-to-br ${p.color} ring-1 ring-cyan-400 shadow-md`
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/10">{p.icon}</div>
                <div>
                  <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    <span>{p.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-400 font-mono">
                      {p.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-cyan-300/80 font-medium">{p.tagline}</div>
                </div>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">{p.description}</p>
          </div>
        );
      })}
    </div>
  );
};
