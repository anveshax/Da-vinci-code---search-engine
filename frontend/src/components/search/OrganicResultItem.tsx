import React, { useState } from 'react';
import { MoreVertical, ExternalLink, Sparkles, Check, Copy } from 'lucide-react';
import { WebSearchResultItem } from '../../types/api';

interface OrganicResultItemProps {
  result: WebSearchResultItem;
  index?: number;
}

export const OrganicResultItem: React.FC<OrganicResultItemProps> = ({ result }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const domain =
    result.source_domain ||
    (result.url ? new URL(result.url).hostname : 'source');

  const isInternal = Boolean(
    (result as any).is_internal_index ||
    (result as any).source === 'ANVESHA Web Intelligence' ||
    (result as any).source === 'anvesha_index'
  );

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsMenuOpen(false);
    }, 1500);
  };

  // Format breadcrumb path: domain > subpath
  let breadcrumb = domain;
  try {
    const urlObj = new URL(result.url);
    const pathname = urlObj.pathname.replace(/\/$/, '');
    if (pathname && pathname !== '/') {
      const parts = pathname.split('/').filter(Boolean);
      breadcrumb = `${domain} › ${parts.slice(0, 2).join(' › ')}`;
    }
  } catch {}

  return (
    <article className="max-w-[652px] py-3 text-left relative group">
      {/* 1. Favicon + Website Name + URL Breadcrumb + Three-Dot Menu */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-sans text-[#bdc1c6] hover:text-[#e8eaed] transition-colors min-w-0"
        >
          <div className="w-6 h-6 rounded-full bg-[#303134] flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
              className="w-4 h-4 rounded-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-medium text-[#dadce0] truncate leading-tight">
              {domain}
            </span>
            <span className="text-[11px] text-[#bdc1c6] truncate leading-tight">
              {breadcrumb}
            </span>
          </div>
        </a>

        {/* Action Menu / Provenance */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* Subtle ANVESHA Index Indicator (Never dominating) */}
          {isInternal && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-sans text-[#8ab4f8] bg-[#303134] border border-[#3c4043] flex items-center gap-1"
              title="Locally indexed & verified by ANVESHA Crawler"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Indexed</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-1 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134] transition-colors"
            title="Result options"
            aria-label="Result options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#303134] border border-[#3c4043] rounded-xl shadow-xl py-1 z-30 text-xs font-sans">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-3 py-1.5 text-left text-[#e8eaed] hover:bg-[#3c4043] flex items-center gap-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied URL!' : 'Copy link'}</span>
              </button>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-3 py-1.5 text-left text-[#e8eaed] hover:bg-[#3c4043] flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in new tab</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 2. Clickable Title Link (18-20px, #8ab4f8, normal font weight) */}
      <h3 className="text-lg sm:text-[20px] font-normal leading-[1.3] my-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8ab4f8] hover:underline cursor-pointer block"
        >
          {result.title}
        </a>
      </h3>

      {/* 3. Snippet (14px, #bdc1c6, comfortable line-height 1.58) */}
      <p className="text-[14px] leading-[1.58] text-[#bdc1c6] font-sans break-words mt-1">
        {result.snippet}
      </p>

      {/* 4. Sitelinks (Only if returned by backend) */}
      {(result as any).sitelinks && (result as any).sitelinks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#3c4043]/50">
          {(result as any).sitelinks.slice(0, 4).map((sl: any, sIdx: number) => (
            <a
              key={sIdx}
              href={sl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#8ab4f8] hover:underline truncate"
            >
              {sl.title}
            </a>
          ))}
        </div>
      )}
    </article>
  );
};
