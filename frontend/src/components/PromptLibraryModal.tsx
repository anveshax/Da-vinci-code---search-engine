import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  X,
  Search,
  Plus,
  Copy,
  Check,
  Send,
  Trash2,
} from 'lucide-react';
import { fetchPrompts, createPrompt, deletePrompt } from '../services/api';
import { PromptItem } from '../types/api';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string) => void;
}

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');
  const [newText, setNewText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPrompts = async () => {
    try {
      const data = await fetchPrompts();
      setPrompts(data);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() && newText.trim()) {
      try {
        const created = await createPrompt(newTitle.trim(), newCategory, newText.trim());
        setPrompts((prev) => [created, ...prev]);
        setIsCreating(false);
        setNewTitle('');
        setNewText('');
      } catch {
        // Ignore
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  const categories = ['All', ...Array.from(new Set(prompts.map((p) => p.category)))];

  const filtered = prompts.filter((p) => {
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    const matchesQuery =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt_text.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-[#090C16] border border-[#1E2638] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-[#1E2638] px-6 flex items-center justify-between bg-[#0C1220]">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Engineering Prompt Library
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Cancel' : 'New Template'}</span>
            </button>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-white/5 space-y-3 bg-[#0B0F1A]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompt templates..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#070A12] border border-[#232B3E] text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-mono shrink-0 transition-colors ${
                  activeCategory === cat
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Create form modal slide */}
        {isCreating && (
          <form onSubmit={handleCreate} className="p-4 bg-[#0E1526] border-b border-amber-500/30 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Template Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#070A12] border border-[#232B3E] text-xs font-mono text-white outline-none"
              />
              <input
                type="text"
                placeholder="Category (e.g. Testing, Security)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-44 px-3 py-1.5 rounded-lg bg-[#070A12] border border-[#232B3E] text-xs font-mono text-white outline-none"
              />
            </div>
            <textarea
              placeholder="Enter reusable prompt instructions..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              required
              className="w-full p-2.5 rounded-lg bg-[#070A12] border border-[#232B3E] text-xs font-mono text-slate-200 outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 rounded bg-white/5 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 rounded bg-amber-400 text-black font-semibold text-xs"
              >
                Save Template
              </button>
            </div>
          </form>
        )}

        {/* Prompt List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#0C101E] border border-[#1E2638] hover:border-amber-500/40 transition-all space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">{item.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-mono">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopy(item.prompt_text, item.id)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                    title="Copy prompt text"
                  >
                    {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      onSelectPrompt(item.prompt_text);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono"
                    title="Insert prompt into chat"
                  >
                    <Send className="w-3 h-3" />
                    <span>Use</span>
                  </button>

                  {item.is_builtin === 0 && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {item.description && (
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  {item.description}
                </p>
              )}

              <div className="p-2.5 rounded-lg bg-[#070A12] border border-white/5 text-[11px] font-mono text-slate-300">
                <code>{item.prompt_text}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
