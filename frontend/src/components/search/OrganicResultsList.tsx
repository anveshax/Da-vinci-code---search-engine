import React from 'react';
import { WebSearchResultItem } from '../../types/api';
import { OrganicResultItem } from './OrganicResultItem';

interface OrganicResultsListProps {
  results: WebSearchResultItem[];
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

export const OrganicResultsList: React.FC<OrganicResultsListProps> = ({
  results,
  onLoadMore,
  isLoadingMore = false,
  hasMore = true,
}) => {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <section aria-label="Search results" className="space-y-6 sm:space-y-7 pt-2">
      {results.map((result, idx) => (
        <OrganicResultItem
          key={result.url || idx}
          result={result}
          index={idx + 1}
        />
      ))}

      {onLoadMore && hasMore && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 rounded-full bg-[#282a2c] hover:bg-[#303134] border border-[#3c4043] text-sm font-medium text-[#8ab4f8] hover:text-[#a8c7fa] transition-colors disabled:opacity-50 cursor-pointer shadow-sm inline-flex items-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin" />
                <span>Loading more results...</span>
              </>
            ) : (
              <span>More search results</span>
            )}
          </button>
        </div>
      )}
    </section>
  );
};
