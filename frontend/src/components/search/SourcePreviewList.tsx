import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CitationItem } from '../../types/api';
import { SourcePreviewCard } from './SourcePreviewCard';

interface SourcePreviewListProps {
  citations: CitationItem[];
  onCodeClick?: (filePath: string, line?: number) => void;
  initialCount?: number;
}

export const SourcePreviewList: React.FC<SourcePreviewListProps> = ({
  citations,
  onCodeClick,
  initialCount = 3,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations || citations.length === 0) {
    return null;
  }

  // Deduplicate citations by URL or title
  const uniqueCitations: CitationItem[] = [];
  const seenKeys = new Set<string>();

  for (const c of citations) {
    const key = (c.url || c.title || c.file_path || '').trim().toLowerCase();
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCitations.push(c);
    }
  }

  const displayedCitations = isExpanded
    ? uniqueCitations
    : uniqueCitations.slice(0, initialCount);

  const remainingCount = uniqueCitations.length - initialCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-sans text-[#bdc1c6]">
        <span className="font-medium text-[#e8eaed]">Sources</span>
        {uniqueCitations.length > initialCount && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>{isExpanded ? 'Show less' : `+${remainingCount} more`}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Grid of source cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {displayedCitations.map((citation, idx) => (
          <SourcePreviewCard
            key={idx}
            citation={citation}
            index={idx + 1}
            onCodeClick={onCodeClick}
          />
        ))}
      </div>
    </div>
  );
};
