import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Trash2,
  Edit2,
  Pin,
  PinOff,
  MessageSquare,
  Clock,
  Calendar,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';
import { Conversation } from '../types/api';

interface HistoryViewProps {
  conversations: Conversation[];
  activeConversationId?: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePinConversation?: (id: string) => void;
  onClearAllHistory?: () => void;
  onNewSearch: () => void;
}

function formatRelativeTime(timestampSeconds?: number): string {
  if (!timestampSeconds) return '';
  const nowMs = Date.now();
  const timeMs = timestampSeconds * 1000;
  const diffMs = nowMs - timeMs;
  if (diffMs < 0 || diffMs < 60 * 1000) return 'Just now';
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const d = new Date(timeMs);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatExactTime(timestampSeconds?: number): string {
  if (!timestampSeconds) return '';
  const d = new Date(timestampSeconds * 1000);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePinConversation,
  onClearAllHistory,
  onNewSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'web' | 'code' | 'deep' | 'pinned'>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteModalConv, setDeleteModalConv] = useState<Conversation | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  // 1. Deduplicate conversations
  const uniqueConversations = useMemo(() => {
    const seen = new Set<string>();
    const list: Conversation[] = [];
    for (const c of conversations) {
      const id = c.id || c.conversation_id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(c);
      }
    }
    return list;
  }, [conversations]);

  // 2. Filter by search query & mode
  const filteredConversations = useMemo(() => {
    let list = uniqueConversations;

    // Mode filter
    if (modeFilter === 'pinned') {
      list = list.filter((c) => Boolean(c.is_pinned));
    } else if (modeFilter === 'web') {
      list = list.filter((c) => (c.search_mode || c.selected_mode) === 'web');
    } else if (modeFilter === 'code') {
      list = list.filter((c) => (c.search_mode || c.selected_mode) === 'code');
    } else if (modeFilter === 'deep') {
      list = list.filter((c) => (c.search_mode || c.selected_mode) === 'deep');
    }

    // Text query filter
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      if (c.messages?.some((m) => m.content.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [uniqueConversations, searchQuery, modeFilter]);

  // 3. Group by Today, Yesterday, Last 7 days, Older
  const { today, yesterday, last7Days, older } = useMemo(() => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    const tList: Conversation[] = [];
    const yList: Conversation[] = [];
    const l7List: Conversation[] = [];
    const oList: Conversation[] = [];

    filteredConversations.forEach((c) => {
      const ts = (c.updated_at || c.created_at || now / 1000) * 1000;
      const age = now - ts;
      if (age < ONE_DAY) {
        tList.push(c);
      } else if (age < 2 * ONE_DAY) {
        yList.push(c);
      } else if (age < 7 * ONE_DAY) {
        l7List.push(c);
      } else {
        oList.push(c);
      }
    });

    return {
      today: tList,
      yesterday: yList,
      last7Days: l7List,
      older: oList,
    };
  }, [filteredConversations]);

  const handleStartRename = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const handleSaveRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameConversation(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleConfirmDelete = () => {
    if (deleteModalConv) {
      onDeleteConversation(deleteModalConv.id);
      setDeleteModalConv(null);
    }
  };

  const handleConfirmClearAll = () => {
    if (onClearAllHistory) {
      onClearAllHistory();
    }
    setIsClearAllModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#050508] text-slate-100 font-sans">
      {/* Top Banner / Google History inspired Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-[#141B2D] bg-gradient-to-r from-[#070B14] via-[#091020] to-[#070B14] shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                <History className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                  <span>ANVESHA Activity & History</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 font-mono">
                    Google History
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Your universal searches, AI inquiries, and research sessions are automatically saved here.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              onClick={onNewSearch}
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm touch-target"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Search</span>
            </button>

            {uniqueConversations.length > 0 && onClearAllHistory && (
              <button
                onClick={() => setIsClearAllModalOpen(true)}
                className="px-3.5 py-2 min-h-[40px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all touch-target"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All History</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 pb-safe custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Controls: Search Bar & Filter Chips */}
          <div className="bg-[#0A0E1A] border border-[#162036] rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all previous activity, topics, and inquiries..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0F1628] border border-[#1E2B4A] text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/60 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 text-xs no-scrollbar">
              <span className="text-slate-400 text-[11px] font-mono mr-1 shrink-0">Filter:</span>

              {[
                { id: 'all', label: `All Activity (${uniqueConversations.length})` },
                { id: 'pinned', label: 'Pinned' },
                { id: 'web', label: 'Web Searches' },
                { id: 'code', label: 'Code Inquiries' },
                { id: 'deep', label: 'Deep Research' },
              ].map((chip) => {
                const isActive = modeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setModeFilter(chip.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 shadow-sm'
                        : 'bg-[#12192E] border border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#18223C]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Empty State */}
          {filteredConversations.length === 0 && (
            <div className="text-center py-16 bg-[#080C16] border border-[#141B2D] rounded-2xl p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">No Activity Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? `No previous searches or conversations matched "${searchQuery}".`
                  : 'Start searching to build your universal AI intelligence history.'}
              </p>
              <button
                onClick={onNewSearch}
                className="mt-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start New Search</span>
              </button>
            </div>
          )}

          {/* Group 1: Today */}
          {today.length > 0 && renderGroupCard('Today', today)}

          {/* Group 2: Yesterday */}
          {yesterday.length > 0 && renderGroupCard('Yesterday', yesterday)}

          {/* Group 3: Last 7 days */}
          {last7Days.length > 0 && renderGroupCard('Last 7 days', last7Days)}

          {/* Group 4: Older */}
          {older.length > 0 && renderGroupCard('Older', older)}
        </div>
      </div>

      {/* Delete Single Item Modal */}
      {deleteModalConv && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setDeleteModalConv(null)}
        >
          <div
            className="w-full max-w-md bg-[#0C1220] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Activity Entry?</h3>
                <p className="text-xs text-slate-400">This record will be permanently deleted from the database.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-200 font-mono truncate">
              "{deleteModalConv.title}"
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalConv(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All History Modal */}
      {isClearAllModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsClearAllModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0C1220] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Clear All History?</h3>
                <p className="text-xs text-slate-400">
                  This will delete all {uniqueConversations.length} saved searches, conversations, and citations.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure? This action is permanent and cannot be undone across backend restarts.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Activity</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderGroupCard(groupTitle: string, items: Conversation[]) {
    return (
      <div key={groupTitle} className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-cyan-300">
            {groupTitle}
          </h2>
          <span className="text-[10px] text-slate-500">({items.length})</span>
        </div>

        <div className="bg-[#090D18] border border-[#162036] rounded-2xl overflow-hidden divide-y divide-[#131B2E] shadow-lg">
          {items.map((item) => renderHistoryRow(item))}
        </div>
      </div>
    );
  }

  function renderHistoryRow(item: Conversation) {
    const isSelected = item.id === activeConversationId;
    const isRenaming = item.id === renamingId;
    const mode = item.search_mode || item.selected_mode || 'auto';
    const msgCount = item.message_count ?? (item.messages ? item.messages.length : undefined);
    const relTime = formatRelativeTime(item.updated_at || item.created_at);
    const exactTime = formatExactTime(item.updated_at || item.created_at);

    // Extract preview snippet from latest assistant message if available
    const lastAssistant = [...(item.messages || [])].reverse().find((m) => m.role === 'assistant');
    const previewSnippet = lastAssistant?.content ? lastAssistant.content.slice(0, 140) + '...' : null;

    if (isRenaming) {
      return (
        <div key={item.id} className="p-3 bg-[#0F162A] flex items-center gap-2">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename(item.id);
              if (e.key === 'Escape') setRenamingId(null);
            }}
            autoFocus
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#070B14] border border-cyan-400 text-xs text-white outline-none"
          />
          <button
            onClick={() => handleSaveRename(item.id)}
            className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setRenamingId(null)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`group p-3.5 hover:bg-[#0E1526] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' : ''
        }`}
      >
        {/* Left info */}
        <div
          className="flex-1 min-w-0 cursor-pointer space-y-1"
          onClick={() => onSelectConversation(item.id)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {item.is_pinned && (
              <span className="p-0.5 rounded bg-amber-500/10 text-amber-400" title="Pinned">
                <Pin className="w-3 h-3 fill-amber-400" />
              </span>
            )}

            <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
              {item.title}
            </span>

            {/* Mode badge */}
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                mode === 'web'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-400/30'
                  : mode === 'code'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                  : mode === 'deep'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-400/30'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
              }`}
            >
              {mode}
            </span>

            {typeof msgCount === 'number' && msgCount > 0 && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                <MessageSquare className="w-3 h-3 text-slate-500" />
                {msgCount}
              </span>
            )}
          </div>

          {/* Snippet preview */}
          {previewSnippet && (
            <p className="text-[11px] text-slate-400 line-clamp-1 font-sans">
              {previewSnippet}
            </p>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {relTime}
            </span>
            <span>•</span>
            <span>{exactTime}</span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onSelectConversation(item.id)}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1 transition-all"
            title="Reopen search session"
          >
            <span>Reopen</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          {onTogglePinConversation && (
            <button
              onClick={() => onTogglePinConversation(item.id)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-amber-300 transition-colors"
              title={item.is_pinned ? 'Unpin' : 'Pin'}
            >
              {item.is_pinned ? (
                <PinOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Pin className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            onClick={() => handleStartRename(item)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Rename"
          >
            <Edit2 className="w-3.5 h-3.5 text-sky-400" />
          </button>

          <button
            onClick={() => setDeleteModalConv(item)}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
            title="Delete entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
};
