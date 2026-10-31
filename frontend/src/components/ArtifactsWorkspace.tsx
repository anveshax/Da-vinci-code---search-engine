import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  FileDown,
  Search,
  BookOpen,
} from 'lucide-react';
import { fetchArtifacts, createArtifact, updateArtifact, deleteArtifact } from '../services/api';
import { Artifact } from '../types/api';
import { MarkdownRenderer } from './MarkdownRenderer';

export const ArtifactsWorkspace: React.FC = () => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const loadArtifacts = async () => {
    try {
      const data = await fetchArtifacts();
      setArtifacts(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadArtifacts();
  }, []);

  const selectedArtifact = artifacts.find((a) => a.id === selectedId) || null;

  const handleCreateNew = async () => {
    try {
      const created = await createArtifact(
        'Untitled Architecture Spec',
        '# Technical Specification\n\n## Overview\nDescribe system design, API contracts, and requirements here.\n',
        'documentation',
        'markdown'
      );
      setArtifacts((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setIsEditing(true);
      setEditTitle(created.title);
      setEditContent(created.content);
    } catch {
      // Ignore
    }
  };

  const handleStartEdit = () => {
    if (!selectedArtifact) return;
    setEditTitle(selectedArtifact.title);
    setEditContent(selectedArtifact.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    try {
      const updated = await updateArtifact(selectedId, editTitle, editContent);
      if (updated) {
        setArtifacts((prev) => prev.map((a) => (a.id === selectedId ? updated : a)));
      }
      setIsEditing(false);
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this artifact?')) {
      await deleteArtifact(id);
      setArtifacts((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    }
  };

  const handleExport = () => {
    if (!selectedArtifact) return;
    const blob = new Blob([selectedArtifact.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedArtifact.title.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = artifacts.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.artifact_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full bg-[#050508] overflow-hidden">
      {/* Left List of Artifacts */}
      <div className="w-full md:w-80 border-r border-[#1B2234] bg-[#07090F] flex flex-col shrink-0">
        <div className="p-3.5 border-b border-[#1A2030] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Project Artifacts</span>
            </span>
            <button
              onClick={handleCreateNew}
              className="p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-mono flex items-center gap-1 px-2 border border-sky-400/30"
              title="Create New Artifact"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search artifacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#0F1422] border border-[#1E2638] text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No saved artifacts. Click 'New' to create a technical spec or report.
            </div>
          ) : (
            filtered.map((art) => {
              const isSelected = art.id === selectedId;
              return (
                <div
                  key={art.id}
                  onClick={() => {
                    setSelectedId(art.id);
                    setIsEditing(false);
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-400/40 text-white shadow-sm'
                      : 'bg-[#0B0F1A] border-[#1C2438] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold font-mono truncate">{art.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(art.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="uppercase">{art.artifact_type}</span>
                    <span>{new Date(art.updated_at * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Artifact Editor / Viewer */}
      <div className="flex-1 flex flex-col h-full bg-[#090C16] overflow-hidden">
        {selectedArtifact ? (
          <>
            {/* Toolbar */}
            <div className="h-14 border-b border-[#1A2030] px-6 flex items-center justify-between bg-[#0C101E] shrink-0">
              <div className="flex items-center gap-2 truncate mr-3">
                <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-bold font-mono text-white truncate">
                  {selectedArtifact.title}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs font-mono transition-colors"
                  >
                    Save Changes
                  </button>
                ) : (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}

                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                  title="Export as Markdown"
                >
                  <FileDown className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
            </div>

            {/* Viewer / Editor Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isEditing ? (
                <div className="space-y-4 max-w-4xl mx-auto h-full flex flex-col">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#070A12] border border-[#232B3E] text-sm font-mono text-white outline-none focus:border-sky-400"
                    placeholder="Artifact Title"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 w-full p-4 rounded-xl bg-[#070A12] border border-[#232B3E] text-xs font-mono text-slate-200 outline-none resize-none leading-relaxed focus:border-sky-400"
                    rows={18}
                  />
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <MarkdownRenderer content={selectedArtifact.content} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-xs font-mono text-slate-500">
            Select an artifact to inspect or create a new technical document.
          </div>
        )}
      </div>
    </div>
  );
};
