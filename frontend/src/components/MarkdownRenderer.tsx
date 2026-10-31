import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onCitationClick?: (filePath: string, line?: number) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onCitationClick,
}) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // Split content by fenced code blocks: ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let blockMatch: RegExpExecArray | null;
  let codeIdxCounter = 0;

  const renderTextSegment = (text: string, keyPrefix: string): React.ReactNode[] => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      const key = `${keyPrefix}-l-${lIdx}`;
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        return <div key={key} className="h-2" />;
      }

      // Headers
      if (line.startsWith('### ')) {
        return (
          <h3 key={key} className="text-base font-semibold text-white mt-4 mb-2 tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan" />
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={key} className="text-lg font-bold text-white mt-5 mb-2.5 tracking-tight border-b border-white/10 pb-1">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={key} className="text-xl font-bold text-white mt-6 mb-3 tracking-tight">
            {line.slice(2)}
          </h1>
        );
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote key={key} className="border-l-2 border-sky-400/50 pl-3.5 py-1 text-slate-300 bg-sky-950/20 rounded-r my-2 text-sm italic">
            {renderInlineMarkdown(line.slice(2), `${key}-bq`)}
          </blockquote>
        );
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={key} className="flex items-start gap-2.5 my-1 text-sm text-slate-300 leading-relaxed pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
            <div className="flex-1">{renderInlineMarkdown(line.slice(2), `${key}-bullet`)}</div>
          </div>
        );
      }

      // Numbered lists
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={key} className="flex items-start gap-2.5 my-1 text-sm text-slate-300 leading-relaxed pl-2">
            <span className="text-xs font-mono font-bold text-sky-400 mt-0.5 shrink-0">{numMatch[1]}.</span>
            <div className="flex-1">{renderInlineMarkdown(numMatch[2], `${key}-num`)}</div>
          </div>
        );
      }

      // Standard paragraph
      return (
        <p key={key} className="text-sm text-slate-300 leading-relaxed my-1.5">
          {renderInlineMarkdown(line, `${key}-p`)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (inlineText: string, keyPrefix: string): React.ReactNode => {
    // Regex for bold, inline code, and links
    const tokens = inlineText.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\[[A-Za-z0-9_\-\./]+:\d+\])/g);

    return tokens.map((token, idx) => {
      const key = `${keyPrefix}-tok-${idx}`;

      // Inline code
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        const codeText = token.slice(1, -1);
        return (
          <code key={key} className="px-1.5 py-0.5 rounded bg-white/10 text-sky-300 font-mono text-[12px] border border-white/5">
            {codeText}
          </code>
        );
      }

      // Bold text
      if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        const boldText = token.slice(2, -2);
        return (
          <strong key={key} className="font-semibold text-white">
            {boldText}
          </strong>
        );
      }

      // Code citation badge (e.g. [src/components/SearchBar.tsx:45])
      const citeMatch = token.match(/^\[([A-Za-z0-9_\-\./]+):(\d+)\]$/);
      if (citeMatch) {
        const filePath = citeMatch[1];
        const lineNum = parseInt(citeMatch[2], 10);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCitationClick && onCitationClick(filePath, lineNum)}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-400/40 text-sky-300 text-[11px] font-mono hover:bg-sky-900/60 transition-colors cursor-pointer"
            title={`View ${filePath} at line ${lineNum}`}
          >
            <span>{filePath.split('/').pop()}:{lineNum}</span>
          </button>
        );
      }

      // Markdown links: [Title](URL)
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const linkTitle = linkMatch[1];
        const linkUrl = linkMatch[2];
        return (
          <a
            key={key}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2 inline-flex items-center gap-0.5 mx-0.5"
          >
            <span>{linkTitle}</span>
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }

      return <span key={key}>{token}</span>;
    });
  };

  while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
    const precedingText = content.slice(lastIndex, blockMatch.index);
    if (precedingText) {
      elements.push(...renderTextSegment(precedingText, `pre-${lastIndex}`));
    }

    const language = blockMatch[1] || 'text';
    const codeBody = blockMatch[2];
    const currentCodeIdx = codeIdxCounter++;

    elements.push(
      <div key={`code-block-${blockMatch.index}`} className="my-3 rounded-xl overflow-hidden border border-[#232B3E] bg-[#080C14]">
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0F141F] border-b border-[#1C2436] text-xs font-mono text-slate-400">
          <span className="uppercase font-semibold tracking-wider text-[11px] text-slate-300">{language}</span>
          <button
            type="button"
            onClick={() => handleCopyCode(codeBody, currentCodeIdx)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Copy code snippet"
          >
            {copiedCodeIdx === currentCodeIdx ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-[11px]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed">
          <code>{codeBody}</code>
        </pre>
      </div>
    );

    lastIndex = codeBlockRegex.lastIndex;
  }

  // Trailing text
  const trailingText = content.slice(lastIndex);
  if (trailingText) {
    elements.push(...renderTextSegment(trailingText, `post-${lastIndex}`));
  }

  return <div className="space-y-1 font-sans">{elements}</div>;
};
