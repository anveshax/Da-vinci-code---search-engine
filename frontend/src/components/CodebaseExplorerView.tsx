import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  Code2,
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { fetchDependencyGraph, getFileContent } from '../services/api';
import { DependencyNode, FileContentResponse } from '../types/api';

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Record<string, FileTreeNode>;
  nodeData?: DependencyNode;
}

export const CodebaseExplorerView: React.FC = () => {
  const [nodes, setNodes] = useState<DependencyNode[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<'tree' | 'preview'>('tree');
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({
    backend: true,
    frontend: true,
    src: true,
    'backend/app': true,
    'backend/engine': true,
    'frontend/src': true,
  });

  const loadTree = async () => {
    setIsLoadingTree(true);
    try {
      const data = await fetchDependencyGraph();
      setNodes(data.nodes || []);
      if (!selectedFile && data.nodes.length > 0) {
        // Select first prominent file (e.g. backend/app/main.py or frontend/src/App.tsx)
        const def = data.nodes.find((n) => n.path.includes('main.py')) || data.nodes[0];
        handleSelectFile(def.path);
      }
    } catch {
      // Handle gracefully
    } finally {
      setIsLoadingTree(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path);
    setMobileTab('preview');
    setIsLoadingContent(true);
    try {
      const res = await getFileContent(path);
      setFileContent(res);
    } catch {
      setFileContent(null);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDir = (dirPath: string) => {
    setOpenDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  // Build hierarchical file tree
  const rootTree: FileTreeNode = { name: 'root', path: '', isDir: true, children: {} };

  nodes.forEach((n) => {
    if (filterQuery && !n.path.toLowerCase().includes(filterQuery.toLowerCase())) {
      return;
    }
    const parts = n.path.split('/');
    let curr = rootTree;
    let accumulatedPath = '';

    parts.forEach((part, idx) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = idx === parts.length - 1;

      if (!curr.children[part]) {
        curr.children[part] = {
          name: part,
          path: accumulatedPath,
          isDir: !isLast,
          children: {},
          nodeData: isLast ? n : undefined,
        };
      }
      curr = curr.children[part];
    });
  });

  const renderTree = (node: FileTreeNode, depth = 0) => {
    const keys = Object.keys(node.children).sort((a, b) => {
      const aIsDir = node.children[a].isDir;
      const bIsDir = node.children[b].isDir;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-0.5">
        {keys.map((k) => {
          const child = node.children[k];
          if (child.isDir) {
            const isOpen = openDirs[child.path] || !!filterQuery;
            return (
              <div key={child.path}>
                <div
                  onClick={() => toggleDir(child.path)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-xs font-mono text-slate-300"
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span className="truncate">{child.name}</span>
                </div>
                {isOpen && renderTree(child, depth + 1)}
              </div>
            );
          } else {
            const isSelected = selectedFile === child.path;
            return (
              <div
                key={child.path}
                onClick={() => handleSelectFile(child.path)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs font-mono transition-colors ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-200 font-semibold border-l-2 border-sky-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
                style={{ paddingLeft: `${depth * 12 + 20}px` }}
              >
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{child.name}</span>
                </div>
                {child.nodeData && (
                  <span className="text-[10px] text-slate-600 shrink-0 font-mono">
                    {child.nodeData.lines}L
                  </span>
                )}
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#050508]">
      {/* Left Tree Explorer (w-72 on desktop; conditional full-width on mobile) */}
      <div className={`w-full md:w-72 border-r border-[#1B2234] bg-[#07090F] flex-col shrink-0 ${
        mobileTab === 'tree' ? 'flex h-full' : 'hidden md:flex'
      }`}>
        <div className="p-3 border-b border-[#1A2030] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-sky-400" />
              <span>Workspace Files</span>
            </span>
            <button
              onClick={loadTree}
              disabled={isLoadingTree}
              className="p-1 rounded text-slate-400 hover:text-white touch-target"
              title="Refresh Tree"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter files..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#0F1422] border border-[#1E2638] text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {renderTree(rootTree)}
        </div>
      </div>

      {/* Right File Preview Panel */}
      <div className={`flex-1 flex-col h-full bg-[#090C16] overflow-hidden ${
        mobileTab === 'preview' ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedFile && (
          <div className="h-12 border-b border-[#1A2030] px-3 sm:px-4 flex items-center justify-between bg-[#0C101E] shrink-0">
            <div className="flex items-center gap-2 truncate mr-2">
              <button
                onClick={() => setMobileTab('tree')}
                className="md:hidden px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-sky-400 shrink-0"
              >
                &larr; Files
              </button>
              <FileCode className="w-4 h-4 text-sky-400 shrink-0 hidden xs:inline" />
              <span className="text-xs font-mono font-bold text-white truncate">
                {selectedFile}
              </span>
              {fileContent && (
                <span className="text-[10px] font-mono text-slate-500 shrink-0 hidden sm:inline">
                  ({fileContent.total_lines} lines &bull; {(fileContent.size_bytes / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            <button
              onClick={handleCopy}
              disabled={!fileContent}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Content Viewer with Line Numbers */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300">
          {isLoadingContent ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              Loading source file...
            </div>
          ) : fileContent ? (
            <div className="flex leading-relaxed">
              {/* Line numbers column */}
              <div className="select-none pr-4 text-right text-slate-600 border-r border-white/5 font-mono">
                {fileContent.content.split('\n').map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>
              {/* Source code column */}
              <div className="pl-4 overflow-x-auto flex-1">
                <pre>
                  <code>{fileContent.content}</code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              Select a file from the explorer tree to preview code.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
