import React, { useState, useEffect } from 'react';
import { Sparkles, Flame, Shield, X, Check, RefreshCw } from 'lucide-react';
import { personaService, PersonaState } from '../services/personaService';
import { PersonaMode } from '../types/api';

interface PersonaIndicatorProps {
  currentTheme: 'dark' | 'light';
  className?: string;
}

export const PersonaIndicator: React.FC<PersonaIndicatorProps> = ({ currentTheme, className = '' }) => {
  const [personaState, setPersonaState] = useState<PersonaState>(personaService.getState());
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    personaService.init(currentTheme);
    const unsubscribe = personaService.subscribe((state) => {
      setPersonaState(state);
    });
    return unsubscribe;
  }, [currentTheme]);

  useEffect(() => {
    personaService.resolve(currentTheme);
  }, [currentTheme]);

  const handleSelectMode = async (mode: PersonaMode) => {
    setIsUpdating(true);
    await personaService.setMode(mode, currentTheme);
    setIsUpdating(false);
    setIsOpen(false);
  };

  const isAngel = personaState.resolved === 'angel';

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Active Persona Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all duration-200 border ${
          isAngel
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : 'bg-red-500/10 text-rose-300 border-rose-500/30 hover:bg-red-500/20 hover:border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
        }`}
        title={`Persona: ${isAngel ? 'Angel (Benevolent & Analytical)' : 'Devil (Cynical & Direct)'} • Mode: ${personaState.mode}`}
      >
        {isAngel ? (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">ANGEL</span>
          </>
        ) : (
          <>
            <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span className="hidden sm:inline">DEVIL</span>
          </>
        )}
        <span className="text-[10px] opacity-60 uppercase">({personaState.mode === 'auto' ? 'AUTO' : 'LOCKED'})</span>
      </button>

      {/* Switcher Modal / Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0b0e17] border border-cyan-500/30 shadow-2xl p-3 z-50 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white tracking-wider">AI PERSONA ENGINE</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            ANVESHA dual-persona synchronization. Controls the behavioral tone and reasoning orientation of AI searches.
          </p>

          <div className="space-y-1.5">
            {/* Auto Mode */}
            <button
              onClick={() => handleSelectMode('auto')}
              disabled={isUpdating}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all border ${
                personaState.mode === 'auto'
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                  : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <div>
                  <div className="font-medium text-white">Auto (Theme Sync)</div>
                  <div className="text-[10px] text-slate-400">Light = Angel, Dark = Devil</div>
                </div>
              </div>
              {personaState.mode === 'auto' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>

            {/* Force Angel */}
            <button
              onClick={() => handleSelectMode('force_angel')}
              disabled={isUpdating}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all border ${
                personaState.mode === 'force_angel'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <div>
                  <div className="font-medium text-amber-300">Force Angel</div>
                  <div className="text-[10px] text-slate-400">Benevolent, objective, ethical truth</div>
                </div>
              </div>
              {personaState.mode === 'force_angel' && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            {/* Force Devil */}
            <button
              onClick={() => handleSelectMode('force_devil')}
              disabled={isUpdating}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all border ${
                personaState.mode === 'force_devil'
                  ? 'bg-rose-500/15 border-rose-500/50 text-white'
                  : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <div>
                  <div className="font-medium text-rose-300">Force Devil</div>
                  <div className="text-[10px] text-slate-400">Direct, critical, cynical pragmatist</div>
                </div>
              </div>
              {personaState.mode === 'force_devil' && <Check className="w-3.5 h-3.5 text-rose-400" />}
            </button>
          </div>

          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-slate-500 text-center font-mono">
            ANVESHA Identity Protocol Active
          </div>
        </div>
      )}
    </div>
  );
};
