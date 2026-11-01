import React from 'react';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { NavigationalResultData } from '../../types/api';

interface NavigationalResultCardProps {
  result: NavigationalResultData;
}

export const NavigationalResultCard: React.FC<NavigationalResultCardProps> = ({ result }) => {
  if (!result || !result.url) {
    return null;
  }

  const domain = result.domain || (result.url ? new URL(result.url).hostname : '');
  const siteName = result.site_name || domain.replace(/^www\./, '');

  return (
    <div className="max-w-[652px] mb-6 p-4 sm:p-5 rounded-2xl bg-[#282a2c] border border-[#3c4043] shadow-md text-left transition-all">
      {/* Top Header: Favicon + Site Name + Verified Official Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#303134] border border-[#3c4043] flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
              alt=""
              className="w-5 h-5 rounded-full"
              onError={(e) => {
                // If favicon fails to load, fallback to Globe icon
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-[#e8eaed] truncate">
                {siteName}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1e3a5f]/60 text-[#8ab4f8] border border-[#8ab4f8]/30 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-[#8ab4f8]" />
                <span>Official</span>
              </span>
            </div>
            <span className="text-xs text-[#9aa0a6] truncate font-mono">
              {result.url}
            </span>
          </div>
        </div>

        {/* Action Button: Visit Website */}
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-full bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124] font-medium text-xs font-sans transition-colors cursor-pointer shadow-sm touch-target"
        >
          <span>Visit website</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Main Title */}
      <h3 className="text-lg sm:text-[20px] font-normal leading-[1.3] my-1.5">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8ab4f8] hover:underline cursor-pointer block"
        >
          {result.title || siteName}
        </a>
      </h3>

      {/* Description Snippet */}
      {result.snippet && (
        <p className="text-[14px] leading-[1.58] text-[#bdc1c6] font-sans break-words mt-1">
          {result.snippet}
        </p>
      )}

      {/* Sitelinks (Key Subpages) */}
      {result.sitelinks && result.sitelinks.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-[#3c4043]/70">
          <div className="text-[11px] font-medium text-[#9aa0a6] uppercase tracking-wider mb-2">
            Key Pages
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.sitelinks.slice(0, 4).map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[#202124]/60 hover:bg-[#303134] border border-[#3c4043]/50 text-xs text-[#8ab4f8] hover:text-[#a8c7fa] hover:underline transition-colors flex items-center justify-between group truncate"
              >
                <span className="truncate">{link.title}</span>
                <ExternalLink className="w-3 h-3 text-[#9aa0a6] group-hover:text-[#8ab4f8] shrink-0 ml-1.5 opacity-60 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
