import React from 'react';
import { ExternalLink, FileCode } from 'lucide-react';
import { CitationItem } from '../../types/api';

interface SourcePreviewCardProps {
  citation: CitationItem;
  index: number;
  onCodeClick?: (filePath: string, line?: number) => void;
}

export const SourcePreviewCard: React.FC<SourcePreviewCardProps> = ({
  citation,
  index,
  onCodeClick,
}) => {
  const isCode = citation.type === 'code';
  const domain = citation.domain || (citation.url ? new URL(citation.url).hostname : 'source');

  const cardContent = (
    <div className="p-2.5 rounded-xl bg-[#202124] hover:bg-[#303134] border border-[#3c4043] hover:border-[#5f6368] transition-all flex flex-col justify-between h-full group text-left">
      <div>
        {/* Favicon + Domain Name + Index */}
        <div className="flex items-center justify-between gap-1.5 text-xs text-[#bdc1c6] mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {isCode ? (
              <FileCode className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />
            ) : (
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                alt=""
                className="w-3.5 h-3.5 rounded-full shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="truncate text-[11px] font-sans font-medium text-[#bdc1c6] group-hover:text-[#e8eaed]">
              {domain}
            </span>
          </div>

          <span className="text-[10px] text-[#9aa0a6] font-mono shrink-0">
            [{index}]
          </span>
        </div>

        {/* Title */}
        <h4 className="text-xs font-sans font-medium text-[#e8eaed] group-hover:text-[#8ab4f8] line-clamp-2 leading-snug mb-1">
          {citation.title || domain}
        </h4>

        {/* Snippet */}
        {citation.snippet && (
          <p className="text-[11px] font-sans text-[#bdc1c6] line-clamp-2 leading-relaxed">
            {citation.snippet}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end text-[10px] text-[#9aa0a6] group-hover:text-[#8ab4f8]">
        <ExternalLink className="w-3 h-3" />
      </div>
    </div>
  );

  if (isCode && citation.file_path && onCodeClick) {
    return (
      <button
        type="button"
        onClick={() => onCodeClick(citation.file_path || '', citation.line_number || 1)}
        className="block w-full text-left cursor-pointer"
      >
        {cardContent}
      </button>
    );
  }

  return (
    <a
      href={citation.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full text-left"
    >
      {cardContent}
    </a>
  );
};
