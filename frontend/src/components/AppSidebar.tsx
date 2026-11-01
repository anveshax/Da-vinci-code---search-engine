import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  History,
  FolderTree,
  Code2,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  Globe,
  Pin,
  PinOff,
  MessageSquare,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { ActiveView, Conversation, Project } from '../types/api';

interface AppSidebarProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  conversations: Conversation[];
  activeConversationId?: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePinConversation?: (id: string) => void;
  onClearAllHistory?: () => void;
  onNewSearch?: () => void;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentView,
  onNavigate,
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePinConversation,
  onClearAllHistory,
  onNewSearch,
  projects,
  activeProject,
  onSelectProject,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmConv, setDeleteConfirmConv] = useState<Conversation | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // 1. Unified Deduplication: Every previous search and conversation belongs to this ONE history
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

  // 2. Filter history based on search query
  const filteredConversations = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return uniqueConversations;
    return uniqueConversations.filter((c) =>
      c.title.toLowerCase().includes(q)
    );
  }, [uniqueConversations, historySearchQuery]);

  // 3. Unified Temporal Grouping: Pinned, Today, Yesterday, Last 7 days, Older
  const { pinned, today, yesterday, last7Days, older } = useMemo(() => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    const pinnedList: Conversation[] = [];
    const todayList: Conversation[] = [];
    const yesterdayList: Conversation[] = [];
    const last7List: Conversation[] = [];
    const olderList: Conversation[] = [];

    filteredConversations.forEach((conv) => {
      if (conv.is_pinned) {
        pinnedList.push(conv);
        return;
      }
      const ts = (conv.updated_at || conv.created_at || now / 1000) * 1000;
      const age = now - ts;
      if (age < ONE_DAY) {
        todayList.push(conv);
      } else if (age < 2 * ONE_DAY) {
        yesterdayList.push(conv);
      } else if (age < 7 * ONE_DAY) {
        last7List.push(conv);
      } else {
        olderList.push(conv);
      }
    });

    return {
      pinned: pinnedList,
      today: todayList,
      yesterday: yesterdayList,
      last7Days: last7List,
      older: olderList,
    };
  }, [filteredConversations]);

  const handleStartRename = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
    setMenuOpenId(null);
  };

  const handleConfirmRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameConversation(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleRequestDelete = (conv: Conversation) => {
    setMenuOpenId(null);
    setDeleteConfirmConv(conv);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmConv) {
      onDeleteConversation(deleteConfirmConv.id);
      setDeleteConfirmConv(null);
    }
  };

  const handleConfirmClearAll = () => {
    if (onClearAllHistory) {
      onClearAllHistory();
    }
    setIsClearAllConfirmOpen(false);
  };

  const handleStartNewSearch = () => {
    if (onNewSearch) {
      onNewSearch();
    } else {
      onNavigate('search');
    }
    onCloseMobile();
  };

  // Single unified navigation items including Google-inspired History
  const navItems = [
    { id: 'search', label: 'AI Search', icon: <Search className="w-4 h-4 text-cyan-400" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4 text-sky-400" /> },
    { id: 'web_intelligence', label: 'Web Intelligence', icon: <Globe className="w-4 h-4 text-teal-400" /> },
    { id: 'web_studio', label: 'Web Studio', icon: <Code2 className="w-4 h-4 text-emerald-400" /> },
  ];

  // Body scroll locking when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileOpen]);

  const sidebarContent = (
    <aside
      className={`h-full bg-[#07090F] border-r border-[#1B2234] flex flex-col justify-between transition-all duration-300 z-40 select-none ${
        isMobileOpen ? 'w-full' : isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header / Brand */}
      <div className="p-3.5 border-b border-[#1A2030] flex items-center justify-between">
        <div
          onClick={handleStartNewSearch}
          className="flex items-center gap-2.5 cursor-pointer overflow-hidden touch-target"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="truncate">
              <span className="text-xs font-bold tracking-wider text-white font-mono block truncate">
                ANVESHA
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                Universal AI Engine
              </span>
            </div>
          )}
        </div>

        {/* Collapse button on desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile close button with min 44px hit-box */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 touch-target"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* New Search Action Button */}
      <div className="p-3">
        <button
          onClick={handleStartNewSearch}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 min-h-[44px] rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-semibold transition-all ${
            isCollapsed && !isMobileOpen ? 'px-0' : ''
          }`}
          title="Start New Search (Ctrl+Shift+N)"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {(!isCollapsed || isMobileOpen) && <span>New AI Search</span>}
        </button>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1.5 custom-scrollbar">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
          {(!isCollapsed || isMobileOpen) && 'Navigation'}
        </div>

        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id as ActiveView);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 border border-cyan-400/30 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
              title={isCollapsed && !isMobileOpen ? item.label : undefined}
            >
              <div className="shrink-0">{item.icon}</div>
              {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Single Unified HISTORY Section (Expanded Mode or Mobile Drawer) */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="pt-3 space-y-2.5">
            <div className="px-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <div
                onClick={() => {
                  onNavigate('history');
                  onCloseMobile();
                }}
                className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300 transition-colors py-1"
                title="Open Google History view"
              >
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold">History</span>
              </div>
              <div className="flex items-center gap-1.5">
                {uniqueConversations.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                    {uniqueConversations.length}
                  </span>
                )}
                {uniqueConversations.length > 0 && onClearAllHistory && (
                  <button
                    onClick={() => setIsClearAllConfirmOpen(true)}
                    className="p-1 rounded hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Clear all history"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* In-sidebar history search input */}
            {uniqueConversations.length > 2 && (
              <div className="px-2">
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Find in history..."
                    className="w-full pl-7 pr-6 py-1 rounded-lg bg-[#0F1424] border border-[#1E2638] text-[11px] text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50 transition-colors font-sans"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Empty history state */}
            {filteredConversations.length === 0 && (
              <div className="px-3 py-4 text-center text-slate-500 text-xs">
                {historySearchQuery ? 'No matching activity' : 'No history yet'}
              </div>
            )}

            {/* Pinned Activity */}
            {pinned.length > 0 && (
              <div className="space-y-0.5">
                <div className="px-2 text-[9px] font-mono text-amber-400/90 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Pin className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  <span>Pinned</span>
                </div>
                {pinned.map((c) => renderHistoryItem(c))}
              </div>
            )}

            {/* Today */}
            {today.length > 0 && (
              <div className="space-y-0.5">
                <div className="px-2 text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Today</div>
                {today.map((c) => renderHistoryItem(c))}
              </div>
            )}

            {/* Yesterday */}
            {yesterday.length > 0 && (
              <div className="space-y-0.5">
                <div className="px-2 text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Yesterday</div>
                {yesterday.map((c) => renderHistoryItem(c))}
              </div>
            )}

            {/* Last 7 days */}
            {last7Days.length > 0 && (
              <div className="space-y-0.5">
                <div className="px-2 text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Last 7 days</div>
                {last7Days.map((c) => renderHistoryItem(c))}
              </div>
            )}

            {/* Older */}
            {older.length > 0 && (
              <div className="space-y-0.5">
                <div className="px-2 text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Older</div>
                {older.map((c) => renderHistoryItem(c))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom User / Settings Footer */}
      <div className="p-3 border-t border-[#1A2030] bg-[#0A0D16] space-y-1.5">
        {/* Active Project Pill */}
        {!isCollapsed && activeProject && (
          <div
            onClick={() => {
              if (projects.length > 1) {
                const nextIdx = (projects.findIndex((p) => p.id === activeProject.id) + 1) % projects.length;
                onSelectProject(projects[nextIdx]);
              }
            }}
            className="px-2 py-1.5 rounded-lg bg-[#0F1422] border border-[#1E2638] hover:border-cyan-500/40 cursor-pointer flex items-center justify-between text-xs font-mono transition-colors"
            title="Click to cycle workspace project"
          >
            <div className="truncate mr-2">
              <span className="text-[10px] text-slate-500 block">Workspace</span>
              <span className="text-slate-200 font-semibold truncate block">{activeProject.name}</span>
            </div>
            <FolderTree className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          </div>
        )}

        <button
          onClick={() => {
            onNavigate('settings');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all ${
            currentView === 'settings' ? 'bg-white/10 text-white font-semibold' : ''
          }`}
          title="Settings (Preferences & Providers)"
        >
          <Settings className="w-4 h-4 shrink-0 text-slate-400" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>

      {/* Delete Single Entry Confirmation Modal */}
      {deleteConfirmConv && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setDeleteConfirmConv(null)}
        >
          <div
            className="w-full max-w-sm bg-[#0E1320] border border-rose-500/40 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete Entry?</h3>
                <p className="text-xs text-slate-400">Permanently removes this search & conversation from history.</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 font-mono truncate">
              "{deleteConfirmConv.title}"
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmConv(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All History Confirmation Modal */}
      {isClearAllConfirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsClearAllConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#0E1320] border border-rose-500/40 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Clear All History?</h3>
                <p className="text-xs text-slate-400">Permanently deletes all searches, conversations, and records.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure? This cannot be undone across browser or server restarts.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  function renderHistoryItem(conv: Conversation) {
    const isSelected = conv.id === activeConversationId;
    const isRenaming = conv.id === renamingId;
    const isMenuOpen = conv.id === menuOpenId;
    const relativeTime = formatRelativeTime(conv.updated_at || conv.created_at);
    const msgCount = conv.message_count ?? (conv.messages ? conv.messages.length : undefined);

    if (isRenaming) {
      return (
        <div key={conv.id} className="px-2 py-1">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleConfirmRename(conv.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmRename(conv.id);
              if (e.key === 'Escape') setRenamingId(null);
            }}
            autoFocus
            className="w-full px-2 py-1 rounded bg-[#101626] border border-cyan-400 text-xs font-sans text-white outline-none"
          />
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        className={`group relative flex flex-col px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border ${
          isSelected
            ? 'bg-cyan-500/15 border-cyan-500/30 text-white font-medium shadow-sm'
            : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
        }`}
        onClick={() => {
          onSelectConversation(conv.id);
          onCloseMobile();
        }}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            {conv.is_pinned && (
              <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0 fill-amber-400" />
            )}
            <span className="truncate text-[12px]" title={conv.title}>
              {conv.title}
            </span>
          </div>

          {/* Hover Action Menu */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
            {onTogglePinConversation && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePinConversation(conv.id);
                }}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-300"
                title={conv.is_pinned ? 'Unpin' : 'Pin activity'}
              >
                {conv.is_pinned ? (
                  <PinOff className="w-3 h-3 text-amber-400" />
                ) : (
                  <Pin className="w-3 h-3" />
                )}
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : conv.id);
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Options"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Sub-row: relative time + message count */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 font-mono">
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {relativeTime}
          </span>
          {typeof msgCount === 'number' && msgCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] px-1 rounded bg-white/5 text-slate-400">
              <MessageSquare className="w-2.5 h-2.5" />
              {msgCount}
            </span>
          )}
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            className="absolute right-2 top-8 z-50 w-32 bg-[#0F1424] border border-[#232B3E] rounded-xl shadow-xl p-1 text-xs space-y-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {onTogglePinConversation && (
              <button
                onClick={() => {
                  onTogglePinConversation(conv.id);
                  setMenuOpenId(null);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white"
              >
                {conv.is_pinned ? (
                  <>
                    <PinOff className="w-3 h-3 text-amber-400" />
                    <span>Unpin</span>
                  </>
                ) : (
                  <>
                    <Pin className="w-3 h-3 text-amber-400" />
                    <span>Pin</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => handleStartRename(conv)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white"
            >
              <Edit2 className="w-3 h-3 text-cyan-400" />
              <span>Rename</span>
            </button>

            <button
              onClick={() => handleRequestDelete(conv)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-full shrink-0">{sidebarContent}</div>

      {/* Mobile Drawer Overlay with Smooth Slide & Safe Area Support */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex">
          <div className="w-[280px] xs:w-72 max-w-[85vw] h-full pt-safe pb-safe shadow-2xl flex flex-col bg-[#07090F] animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
          <div
            className="flex-1"
            onClick={onCloseMobile}
            aria-label="Close navigation overlay"
          />
        </div>
      )}
    </>
  );
};
