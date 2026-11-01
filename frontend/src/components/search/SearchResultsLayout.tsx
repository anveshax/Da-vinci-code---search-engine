import React from 'react';

interface SearchResultsLayoutProps {
  header: React.ReactNode;
  navigationTabs: React.ReactNode;
  children: React.ReactNode;
  secondaryColumn?: React.ReactNode;
}

export const SearchResultsLayout: React.FC<SearchResultsLayoutProps> = ({
  header,
  navigationTabs,
  children,
  secondaryColumn,
}) => {
  return (
    <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col bg-[#202124] text-[#e8eaed] font-sans selection:bg-[#8ab4f8]/30 selection:text-[#e8eaed] scroll-smooth">
      {/* 1. Header (Sticky Top) */}
      <div className="sticky top-0 z-30 bg-[#202124]">
        {header}
        {navigationTabs}
      </div>

      {/* 2. Centered Content Container (max-width ~1100px - 1140px) */}
      <div className="w-full max-w-[1140px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 pb-safe flex-1">
        {secondaryColumn ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Primary Reading Column (~650-700px on desktop) */}
            <main className="lg:col-span-7 xl:col-span-7 max-w-[692px] w-full">
              {children}
            </main>

            {/* Secondary Right Column (Knowledge Panel, Weather, Maps ~360-400px) */}
            <aside className="lg:col-span-5 xl:col-span-5 w-full space-y-5 lg:sticky lg:top-28">
              {secondaryColumn}
            </aside>
          </div>
        ) : (
          <main className="max-w-[692px] w-full text-left">
            {children}
          </main>
        )}
      </div>
    </div>
  );
};
