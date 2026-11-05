import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Printer,
  Check,
  Clock,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { ReaderArticle } from '../types/api';

interface ReaderModeViewProps {
  article: ReaderArticle;
  onClose: () => void;
}

export const ReaderModeView: React.FC<ReaderModeViewProps> = ({ article, onClose }) => {
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [readerTheme, setReaderTheme] = useState<'dark' | 'sepia' | 'light'>('dark');
  const [copied, setCopied] = useState(false);

  const fontSizes = {
    sm: 'text-sm leading-relaxed',
    md: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
    xl: 'text-xl leading-loose',
  };

  const themeStyles = {
    dark: 'bg-[#0b0e17] text-slate-200 border-white/10',
    sepia: 'bg-[#fbf0d9] text-[#433422] border-[#e2d5b9]',
    light: 'bg-white text-slate-800 border-slate-200',
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(article.content_markdown || article.excerpt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto flex flex-col ${themeStyles[readerTheme]}`}>
      {/* Reader Mode Top Bar */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-opacity-90 border-b px-4 sm:px-8 py-3 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent hover:border-current transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Browser</span>
          </button>
          <div className="hidden md:flex items-center gap-2 text-xs opacity-75">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold uppercase tracking-wider">Reader Mode</span>
            {article.site_name && <span>• {article.site_name}</span>}
          </div>
        </div>

        {/* Reader Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Font Size Selector */}
          <div className="flex items-center gap-1 bg-black/10 rounded-lg p-1 border border-black/10">
            {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setFontSize(sz)}
                className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                  fontSize === sz ? 'bg-cyan-500 text-white shadow-sm' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {sz.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Theme Selector */}
          <div className="flex items-center gap-1 bg-black/10 rounded-lg p-1 border border-black/10">
            <button
              onClick={() => setReaderTheme('dark')}
              className={`w-5 h-5 rounded-full bg-[#0b0e17] border ${
                readerTheme === 'dark' ? 'border-cyan-400 scale-110' : 'border-white/20'
              }`}
              title="Dark Theme"
            />
            <button
              onClick={() => setReaderTheme('sepia')}
              className={`w-5 h-5 rounded-full bg-[#fbf0d9] border ${
                readerTheme === 'sepia' ? 'border-amber-600 scale-110' : 'border-amber-300'
              }`}
              title="Sepia Theme"
            />
            <button
              onClick={() => setReaderTheme('light')}
              className={`w-5 h-5 rounded-full bg-white border ${
                readerTheme === 'light' ? 'border-cyan-600 scale-110' : 'border-slate-300'
              }`}
              title="Light Theme"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg opacity-75 hover:opacity-100 transition-opacity"
            title="Copy Markdown Text"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="p-1.5 rounded-lg opacity-75 hover:opacity-100 transition-opacity"
            title="Print or Save PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Open Original */}
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg opacity-75 hover:opacity-100 transition-opacity"
            title="Open Original Page"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Reader Content Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 sm:px-12 py-10">
        {/* Article Metadata */}
        <div className="mb-8 pb-6 border-b border-current opacity-30">
          <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight mb-3">
            {article.title || 'Extracted Article'}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono opacity-80">
            {article.author && <span>By {article.author}</span>}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {article.reading_time_minutes || 2} min read
            </span>
            <span>{article.word_count || 0} words</span>
          </div>
        </div>

        {/* Clean Article Body */}
        <article className={`font-serif ${fontSizes[fontSize]} whitespace-pre-wrap selection:bg-cyan-500/30`}>
          {article.content_markdown || article.excerpt}
        </article>
      </main>
    </div>
  );
};
