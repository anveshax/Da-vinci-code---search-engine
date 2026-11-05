import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Plus,
  Trash2,
  ExternalLink,
  Folder,
  Search,
  AlertCircle,
} from 'lucide-react';
import { fetchBrowserBookmarks, createBrowserBookmark, deleteBrowserBookmark } from '../services/api';
import { BrowserBookmark } from '../types/api';

interface BookmarksViewProps {
  onOpenUrl?: (url: string) => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({ onOpenUrl }) => {
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newFolder, setNewFolder] = useState('General');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBookmarks = async () => {
    try {
      const data = await fetchBrowserBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    }
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const folders = ['All', ...Array.from(new Set(bookmarks.map((b) => b.folder || 'General')))];

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesFolder = selectedFolder === 'All' || (b.folder || 'General') === selectedFolder;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.url.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!newUrl.trim()) return;

    // Check duplicate
    const exists = bookmarks.some((b) => b.url.toLowerCase() === newUrl.trim().toLowerCase());
    if (exists) {
      setErrorMsg('This URL is already bookmarked.');
      return;
    }

    try {
      await createBrowserBookmark(newTitle.trim() || newUrl.trim(), newUrl.trim(), newFolder.trim());
      setNewTitle('');
      setNewUrl('');
      setIsAddOpen(false);
      await loadBookmarks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add bookmark');
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await deleteBrowserBookmark(id);
      await loadBookmarks();
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] text-slate-200 p-4 sm:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bookmark className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white">
              ANVESHA BOOKMARKS & FOLDERS
            </h1>
          </div>
          <p className="text-sm text-slate-400 font-sans">
            Encrypted bookmark library organized by folder taxonomy with duplicate detection.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500 text-black font-semibold text-xs font-mono hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bookmark</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bookmarks by title or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0b0e17] border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
          />
        </div>

        {/* Folder Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFolder(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all border ${
                selectedFolder === f
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                  : 'bg-white/5 border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bookmarks Grid */}
      <div className="max-w-6xl mx-auto">
        {filteredBookmarks.length === 0 ? (
          <div className="text-center py-16 bg-[#0b0e17] rounded-2xl border border-white/5">
            <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-mono">No bookmarks found</p>
            <p className="text-xs text-slate-500 mt-1">Add links to your persistent reading and research folders.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBookmarks.map((b) => (
              <div
                key={b.id}
                className="group p-4 rounded-xl bg-[#0b0e17] border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 flex items-center gap-1">
                      <Folder className="w-3 h-3 text-cyan-400" />
                      <span>{b.folder || 'General'}</span>
                    </span>
                    <button
                      onClick={() => handleDeleteBookmark(b.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      title="Delete bookmark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="font-medium text-white text-sm line-clamp-1 mb-1">{b.title}</h3>
                  <p className="text-xs text-slate-400 font-mono line-clamp-1 break-all">{b.url}</p>
                </div>

                <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(b.created_at * 1000).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {onOpenUrl && (
                      <button
                        onClick={() => onOpenUrl(b.url)}
                        className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-medium"
                      >
                        Open in Browser
                      </button>
                    )}
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                      title="Open external tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Bookmark Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form
            onSubmit={handleAddBookmark}
            className="max-w-md w-full bg-[#0b0e17] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="text-base font-mono font-bold text-white mb-4 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-cyan-400" />
              <span>Add Bookmark</span>
            </h3>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Wikipedia: Artificial Intelligence"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">URL (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="https://en.wikipedia.org/wiki/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Folder</label>
                <input
                  type="text"
                  placeholder="General, Research, Tor, etc."
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 text-xs font-mono hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-mono font-bold text-xs hover:bg-cyan-400"
              >
                Save Bookmark
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
