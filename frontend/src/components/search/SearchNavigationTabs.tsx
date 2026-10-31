import React from 'react';
import {
  Layers,
  Sparkles,
  Image as ImageIcon,
  Newspaper,
  MapPin,
  Video,
  FolderCode,
  Wrench
} from 'lucide-react';

export type SearchNavTabId =
  | 'all'
  | 'ai_overview'
  | 'images'
  | 'news'
  | 'maps'
  | 'videos'
  | 'code'
  | 'deep'
  | 'tools';

interface SearchNavigationTabsProps {
  activeTab: SearchNavTabId;
  onSelectTab: (tab: SearchNavTabId) => void;
  hasImages?: boolean;
  hasNews?: boolean;
  hasMap?: boolean;
  hasCode?: boolean;
}

export const SearchNavigationTabs: React.FC<SearchNavigationTabsProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const tabs: Array<{ id: SearchNavTabId; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All', icon: <Layers className="w-4 h-4" /> },
    { id: 'ai_overview', label: 'AI Overview', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'images', label: 'Images', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'news', label: 'News', icon: <Newspaper className="w-4 h-4" /> },
    { id: 'maps', label: 'Maps', icon: <MapPin className="w-4 h-4" /> },
    { id: 'videos', label: 'Videos', icon: <Video className="w-4 h-4" /> },
    { id: 'code', label: 'Code', icon: <FolderCode className="w-4 h-4" /> },
    { id: 'deep', label: 'Deep Research', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full bg-[#202124] border-b border-[#3c4043] px-4 sm:px-6 transition-colors">
      <div className="max-w-[1240px] mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-sans whitespace-nowrap transition-colors relative cursor-pointer ${
                isActive
                  ? 'text-[#8ab4f8] font-medium'
                  : 'text-[#bdc1c6] hover:text-[#e8eaed]'
              }`}
            >
              <span className={`shrink-0 ${isActive ? 'text-[#8ab4f8]' : 'text-[#9aa0a6]'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>

              {/* Clean thin white/blue underline indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#8ab4f8] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
