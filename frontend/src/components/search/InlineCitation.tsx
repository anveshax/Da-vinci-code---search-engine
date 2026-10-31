import React from 'react';
import { CitationItem } from '../../types/api';

interface InlineCitationProps {
  index: number;
  citation?: CitationItem;
  onCodeClick?: (filePath: string, line?: number) => void;
}

export const InlineCitation: React.FC<InlineCitationProps> = ({
  index,
  citation,
  onCodeClick,
}) => {
  if (!citation) {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-sans font-medium bg-[#303134] text-[#bdc1c6] rounded-full mx-0.5 align-super cursor-default">
        {index}
      </span>
    );
  }

  if (citation.type === 'code' && citation.file_path && onCodeClick) {
    return (
      <button
        type="button"
        onClick={() => onCodeClick(citation.file_path || '', citation.line_number || 1)}
        className="inline-flex items-center justify-center h-4 px-1 text-[10px] font-sans font-medium bg-[#303134] hover:bg-[#3c4043] text-[#8ab4f8] rounded-full mx-0.5 align-super border border-[#3c4043] transition-colors"
        title={`View ${citation.title} at line ${citation.line_number}`}
      >
        <span>{index}</span>
      </button>
    );
  }

  const url = citation.url || '#';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center h-4 px-1.5 text-[10px] font-sans font-medium bg-[#303134] hover:bg-[#3c4043] text-[#8ab4f8] rounded-full mx-0.5 align-super border border-[#3c4043] hover:border-[#8ab4f8] transition-colors group"
      title={`${citation.title} — ${citation.domain || citation.url}`}
    >
      <span>{index}</span>
    </a>
  );
};
