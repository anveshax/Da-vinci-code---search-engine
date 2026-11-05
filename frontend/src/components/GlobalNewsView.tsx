import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  Layers,
  Bot,
  X,
  Share2,
  Check,
  SlidersHorizontal,
  Flame,
  Zap,
  Newspaper,
} from 'lucide-react';
import {
  GlobalNewsArticle,
  GlobalStoryCluster,
  GlobalNewsTrendingItem,
  CountryOption,
  LanguageOption,
  CategoryOption,
  GlobalNewsBriefing,
  AskAIStoryResult,
} from '../types/api';
import {
  fetchWorldwideNews,
  searchWorldwideNews,
  fetchNewsCountries,
  fetchNewsLanguages,
  fetchNewsCategories,
  fetchNewsTrending,
  generateNewsBriefing,
  askAIAboutStory,
  createNewsSSEConnection,
} from '../services/api';

export interface GlobalNewsViewProps {
  initialQuery?: string;
  isEmbedded?: boolean;
}

export const GlobalNewsView: React.FC<GlobalNewsViewProps> = ({
  initialQuery,
  isEmbedded = false,
}) => {
  // Navigation & Filter State
  const [selectedCountry, setSelectedCountry] = useState<string>('WORLD');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'latest' | 'relevance'>('latest');
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery || '');
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(false);

  // Sync initialQuery when prop updates
  useEffect(() => {
    if (initialQuery !== undefined) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  // Data State
  const [articles, setArticles] = useState<GlobalNewsArticle[]>([]);
  const [clusters, setClusters] = useState<GlobalStoryCluster[]>([]);
  const [breakingArticles, setBreakingArticles] = useState<GlobalNewsArticle[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<GlobalNewsTrendingItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Metadata Options
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Saved Stories
  const [savedArticles, setSavedArticles] = useState<Record<string, GlobalNewsArticle>>(() => {
    try {
      const stored = localStorage.getItem('anvesha_saved_news');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Modals & Drawers
  const [selectedCluster, setSelectedCluster] = useState<GlobalStoryCluster | null>(null);
  const [briefingModalOpen, setBriefingModalOpen] = useState<boolean>(false);
  const [briefingData, setBriefingData] = useState<GlobalNewsBriefing | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState<boolean>(false);

  const [askAIModalOpen, setAskAIModalOpen] = useState<boolean>(false);
  const [activeStoryForAI, setActiveStoryForAI] = useState<GlobalNewsArticle | null>(null);
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiAnswerData, setAiAnswerData] = useState<AskAIStoryResult | null>(null);
  const [isAskingAI, setIsAskingAI] = useState<boolean>(false);

  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Load Metadata
  useEffect(() => {
    async function loadMeta() {
      const [cList, lList, catList, trendList] = await Promise.all([
        fetchNewsCountries(),
        fetchNewsLanguages(),
        fetchNewsCategories(),
        fetchNewsTrending(),
      ]);
      setCountries(cList);
      setLanguages(lList);
      setCategories(catList);
      setTrendingTopics(trendList);
    }
    loadMeta();
  }, []);

  // Fetch News Feed
  const loadNewsFeed = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      if (searchQuery.trim()) {
        const searchRes = await searchWorldwideNews(searchQuery.trim(), {
          country: selectedCountry,
          language: selectedLanguage,
          category: selectedCategory,
          sort: sortOrder,
          limit: 35,
        });
        setArticles(searchRes.articles);
        setClusters(searchRes.clusters);
      } else {
        const res = await fetchWorldwideNews({
          country: selectedCountry,
          language: selectedLanguage,
          category: selectedCategory,
          sort: sortOrder,
          limit: 35,
        });
        setArticles(res.articles);
        setClusters(res.clusters);
        setBreakingArticles(res.breaking || []);
        setLastUpdated(res.last_updated);
      }
    } catch (err) {
      console.error('Failed to load global news:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCountry, selectedLanguage, selectedCategory, sortOrder, searchQuery]);

  useEffect(() => {
    loadNewsFeed();
  }, [loadNewsFeed]);

  // Real-time SSE Live Updates Listener
  useEffect(() => {
    const unsubscribe = createNewsSSEConnection((data) => {
      if (data.event === 'news_updated') {
        // Silently refresh in background
        loadNewsFeed(true);
      }
    });
    return () => unsubscribe();
  }, [loadNewsFeed]);

  // Toggle Bookmark
  const toggleSaveArticle = (art: GlobalNewsArticle) => {
    setSavedArticles((prev) => {
      const next = { ...prev };
      if (next[art.id]) {
        delete next[art.id];
      } else {
        next[art.id] = art;
      }
      try {
        localStorage.setItem('anvesha_saved_news', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Copy Link
  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopyToast('Link copied to clipboard!');
    setTimeout(() => setCopyToast(null), 2500);
  };

  // Generate Daily AI Global Briefing
  const handleOpenBriefing = async () => {
    setBriefingModalOpen(true);
    setIsGeneratingBriefing(true);
    try {
      const briefing = await generateNewsBriefing({
        topic: selectedCategory !== 'all' ? selectedCategory : undefined,
        country: selectedCountry !== 'WORLD' ? selectedCountry : undefined,
        language: selectedLanguage !== 'all' ? selectedLanguage : undefined,
      });
      setBriefingData(briefing);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // Ask AI about Story
  const handleOpenAskAI = (art: GlobalNewsArticle) => {
    setActiveStoryForAI(art);
    setAiQuestion('');
    setAiAnswerData(null);
    setAskAIModalOpen(true);
  };

  const handleSendAIQuestion = async (presetQ?: string) => {
    const q = presetQ || aiQuestion;
    if (!q.trim() || !activeStoryForAI) return;
    setIsAskingAI(true);
    try {
      const res = await askAIAboutStory(activeStoryForAI.id, q.trim());
      setAiAnswerData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAskingAI(false);
    }
  };

  // Display Articles List
  const displayedArticles = useMemo(() => {
    if (showSavedOnly) {
      return Object.values(savedArticles);
    }
    return articles;
  }, [showSavedOnly, savedArticles, articles]);

  // Relative Time Helper
  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full text-[#f1f5f9] selection:bg-[#38bdf8]/30 font-sans ${
      isEmbedded ? 'bg-transparent w-full' : 'bg-[#050508] overflow-y-auto'
    }`}>
      {/* Toast Notification */}
      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] border border-[#38bdf8]/40 text-[#38bdf8] px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-fade-in backdrop-blur-xl">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className={`${
        isEmbedded
          ? 'border border-white/10 bg-[#0a0d14]/80 backdrop-blur-xl rounded-2xl mb-4 px-3 sm:px-5 py-3 shadow-lg'
          : 'border-b border-white/10 bg-[#0a0d14]/80 backdrop-blur-2xl sticky top-0 z-30 px-3 sm:px-6 py-3'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title & Live Status Indicator */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/30 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <Globe className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-wide text-white uppercase flex items-center gap-1.5">
                    Global News Intelligence
                  </h1>
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <div className="text-[11px] text-[#94a3b8] flex items-center gap-2">
                  <span>Free worldwide multi-source feed</span>
                  {lastUpdated && (
                    <>
                      <span>•</span>
                      <span>Synced {formatRelativeTime(lastUpdated)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Action Controls */}
            <div className="flex items-center gap-2">
              {/* Daily Global Briefing Button */}
              <button
                onClick={handleOpenBriefing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 text-[#8ab4f8] border border-[#8ab4f8]/30 transition-all shadow-[0_0_12px_rgba(138,180,248,0.15)]"
                title="Generate AI Global Intelligence Briefing"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xs:inline">Daily Briefing</span>
              </button>

              {/* Saved Stories Toggle */}
              <button
                onClick={() => setShowSavedOnly(!showSavedOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  showSavedOnly
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                    : 'bg-white/[0.04] text-[#94a3b8] border-white/10 hover:text-white hover:bg-white/[0.08]'
                }`}
                title="View Bookmarked Stories"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved ({Object.keys(savedArticles).length})</span>
              </button>

              {/* Manual Refresh Button */}
              <button
                onClick={() => loadNewsFeed(true)}
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#94a3b8] hover:text-white transition-all disabled:opacity-50"
                title="Refresh news feeds now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search, Country & Language Filter Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadNewsFeed()}
                placeholder="Search worldwide headlines, topics, publishers..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0e1320] border border-white/10 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]/50 focus:ring-1 focus:ring-[#38bdf8]/30 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Country Selector */}
            <div className="relative">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="appearance-none bg-[#0e1320] border border-white/10 text-xs text-[#cbd5e1] py-2 pl-3 pr-7 rounded-xl focus:outline-none focus:border-[#38bdf8]/40 cursor-pointer"
                title="Select country or worldwide"
              >
                <option value="WORLD">🌐 Worldwide</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
            </div>

            {/* Language Selector */}
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="appearance-none bg-[#0e1320] border border-white/10 text-xs text-[#cbd5e1] py-2 pl-3 pr-7 rounded-xl focus:outline-none focus:border-[#38bdf8]/40 cursor-pointer"
                title="Filter by language"
              >
                <option value="all">All Languages</option>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'latest' ? 'relevance' : 'latest')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-[#0e1320] border border-white/10 text-[#94a3b8] hover:text-white transition-colors"
              title="Toggle sort order"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>{sortOrder === 'latest' ? 'Latest First' : 'Most Relevant'}</span>
            </button>
          </div>

          {/* Category Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                selectedCategory === 'all'
                  ? 'bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                  : 'bg-white/[0.04] text-[#94a3b8] border-white/10 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              All News
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                    : 'bg-white/[0.04] text-[#94a3b8] border-white/10 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 flex flex-col gap-6">
        {/* Breaking News Marquee */}
        {breakingArticles.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-rose-950/40 via-red-950/20 to-transparent border border-rose-500/30 p-2.5 sm:p-3 flex items-center gap-3 overflow-hidden shadow-[0_0_20px_rgba(244,63,94,0.15)]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] tracking-wider uppercase shrink-0 shadow-sm animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Breaking</span>
            </div>
            <div className="flex-1 overflow-x-auto scrollbar-none flex items-center gap-6 whitespace-nowrap text-xs text-rose-100">
              {breakingArticles.slice(0, 5).map((b, idx) => (
                <a
                  key={idx}
                  href={b.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline flex items-center gap-1.5"
                >
                  {b.image_url && (
                    <img
                      src={b.image_url}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span className="font-semibold text-rose-300">[{b.source_name}]</span>
                  <span>{b.title}</span>
                  <ExternalLink className="w-3 h-3 text-rose-400" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Trending Event Topics */}
        {trendingTopics.length > 0 && !showSavedOnly && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 uppercase tracking-wider shrink-0 pr-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Trending:</span>
            </div>
            {trendingTopics.slice(0, 8).map((t, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchQuery(t.topic);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1320] border border-white/10 hover:border-amber-400/40 text-xs text-[#cbd5e1] hover:text-white whitespace-nowrap transition-colors"
              >
                <span>{t.topic}</span>
                {t.outlets_count > 1 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    {t.outlets_count} outlets
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
            <div className="text-xs font-mono text-cyan-400 tracking-wider uppercase">
              Aggregating verified worldwide feeds...
            </div>
          </div>
        ) : displayedArticles.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <Globe className="w-12 h-12 text-[#475569]" />
            <h3 className="text-base font-semibold text-white">No stories match your criteria</h3>
            <p className="text-xs text-[#94a3b8] max-w-sm">
              Try adjusting your country, language, or category filters to explore global coverage.
            </p>
            <button
              onClick={() => {
                setSelectedCountry('WORLD');
                setSelectedLanguage('all');
                setSelectedCategory('all');
                setSearchQuery('');
                setShowSavedOnly(false);
              }}
              className="mt-2 px-4 py-2 rounded-xl text-xs bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 hover:bg-[#38bdf8]/30 transition-all"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* News Articles & Clusters Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedArticles.map((art) => {
              const isSaved = Boolean(savedArticles[art.id]);
              const matchingCluster = clusters.find((c) => c.cluster_id === art.cluster_id || c.primary_article.id === art.id);
              const relatedCount = matchingCluster ? matchingCluster.related_articles.length : 0;
              const outletsCount = matchingCluster ? matchingCluster.outlets_count : art.outlets_count;

              return (
                <div
                  key={art.id}
                  className="group rounded-2xl bg-[#0c101a]/90 border border-white/10 hover:border-[#38bdf8]/40 backdrop-blur-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(56,189,248,0.06)] relative overflow-hidden"
                >
                  <div>
                    {/* Article Featured Image */}
                    {art.image_url ? (
                      <a
                        href={art.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative w-full h-44 mb-3 rounded-xl overflow-hidden bg-slate-900 border border-white/5 group/img"
                        title={art.title}
                      >
                        <img
                          src={art.image_url}
                          alt={art.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            // If hotlinking fails or image URL is broken, collapse container gracefully
                            (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c101a]/80 via-transparent to-transparent pointer-events-none" />
                        <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-cyan-300 uppercase">
                          {art.category}
                        </span>
                      </a>
                    ) : (
                      <div className="relative w-full h-20 mb-3 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-950/20 via-[#0d1424] to-blue-950/20 border border-white/5 flex items-center justify-between px-3">
                        <div className="flex items-center gap-2">
                          <Newspaper className="w-5 h-5 text-cyan-400/50" />
                          <span className="text-xs text-slate-300 font-medium truncate max-w-[180px]">{art.source_name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-slate-400 uppercase">
                          {art.category}
                        </span>
                      </div>
                    )}

                    {/* Card Header: Publisher, Timestamp, Multi-Outlet Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-white truncate max-w-[150px]">
                          {art.source_name}
                        </span>
                        <span className="text-[#64748b]">•</span>
                        <span className="text-[#94a3b8] text-[11px] shrink-0">
                          {formatRelativeTime(art.published_at)}
                        </span>
                      </div>

                      {/* Outlet Corroboration Badge */}
                      {outletsCount > 1 ? (
                        <span
                          className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0"
                          title={`Verified across ${outletsCount} independent publisher outlets`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                          <span>{outletsCount} outlets</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[#94a3b8] shrink-0 uppercase">
                          {art.category}
                        </span>
                      )}
                    </div>

                    {/* Headline (Links directly to original publisher article) */}
                    <a
                      href={art.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm sm:text-base font-semibold text-[#f8fafc] group-hover:text-cyan-300 transition-colors line-clamp-3 leading-snug mb-2"
                      title={art.title}
                    >
                      {art.title}
                    </a>

                    {/* Summary / Excerpt */}
                    {art.summary && (
                      <p className="text-xs text-[#94a3b8] line-clamp-3 leading-relaxed mb-3">
                        {art.summary}
                      </p>
                    )}

                    {/* Corroborating outlets trigger if in a cluster */}
                    {matchingCluster && relatedCount > 0 && (
                      <button
                        onClick={() => setSelectedCluster(matchingCluster)}
                        className="mb-3 w-full py-1.5 px-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-[11px] text-[#8ab4f8] flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#8ab4f8]" />
                          <span>+{relatedCount} other perspectives</span>
                        </div>
                        <span className="text-[10px] text-[#64748b]">View Cluster →</span>
                      </button>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 mt-auto">
                    {/* Read Full Article on Publisher */}
                    <a
                      href={art.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#8ab4f8] hover:text-white transition-colors"
                    >
                      <span>Read on {art.source_domain || 'Publisher'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Right action icons: Ask AI, Save, Share */}
                    <div className="flex items-center gap-1">
                      {/* Ask AI Button */}
                      <button
                        onClick={() => handleOpenAskAI(art)}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:text-cyan-300 hover:bg-white/10 transition-colors"
                        title="Ask AI Intelligence about this story"
                      >
                        <Bot className="w-4 h-4" />
                      </button>

                      {/* Bookmark Button */}
                      <button
                        onClick={() => toggleSaveArticle(art)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSaved
                            ? 'text-amber-400 bg-amber-400/10'
                            : 'text-[#94a3b8] hover:text-white hover:bg-white/10'
                        }`}
                        title={isSaved ? 'Remove from saved' : 'Save article'}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>

                      {/* Share Link Button */}
                      <button
                        onClick={() => handleCopyLink(art.original_url)}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"
                        title="Copy article link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- MODAL 1: AI Daily Global Briefing --- */}
      {briefingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-3xl bg-[#0c101a] border border-[#38bdf8]/30 rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {briefingData?.title || 'Global News Intelligence Briefing'}
                  </h3>
                  <div className="text-xs text-[#94a3b8]">{briefingData?.date}</div>
                </div>
              </div>
              <button
                onClick={() => setBriefingModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-[#94a3b8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs sm:text-sm text-[#cbd5e1] leading-relaxed">
              {isGeneratingBriefing ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                  <div className="text-xs font-mono text-cyan-400">Synthesizing worldwide reports...</div>
                </div>
              ) : briefingData ? (
                <>
                  {/* Executive AI Synthesis */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                    <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Executive Overview</span>
                    </div>
                    <div className="whitespace-pre-line text-slate-200">
                      {briefingData.summary}
                    </div>
                  </div>

                  {/* Key Events Clusters */}
                  {briefingData.key_events.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                        Key Worldwide Developments
                      </h4>
                      <div className="space-y-2">
                        {briefingData.key_events.map((ev, i) => (
                          <div key={i} className="p-3 rounded-xl bg-[#131926] border border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-white">{ev.headline}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300">
                                {ev.outlets_count} outlets
                              </span>
                            </div>
                            {ev.key_facts.map((f, fi) => (
                              <div key={fi} className="text-xs text-[#94a3b8]">
                                • {f}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources Citations */}
                  {briefingData.sources.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                        Supporting Sources & Citations
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {briefingData.sources.map((s, si) => (
                          <a
                            key={si}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-[#8ab4f8] hover:text-white truncate flex items-center justify-between"
                          >
                            <span className="truncate">{s.title} ({s.source_name})</span>
                            <ExternalLink className="w-3 h-3 shrink-0 ml-1.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="text-[11px] text-[#64748b] italic border-t border-white/5 pt-2">
                    {briefingData.disclaimer}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Multi-Source Cluster Inspector --- */}
      {selectedCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0c101a] border border-white/10 rounded-2xl shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#8ab4f8]" />
                <span className="font-bold text-white text-sm">
                  Story Coverage Cluster ({selectedCluster.outlets_count} Independent Outlets)
                </span>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-[#94a3b8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              {/* Primary Article */}
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 overflow-hidden">
                {selectedCluster.primary_article.image_url && (
                  <div className="relative w-full h-44 mb-3 rounded-lg overflow-hidden bg-slate-900 border border-white/5">
                    <img
                      src={selectedCluster.primary_article.image_url}
                      alt={selectedCluster.primary_article.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  Primary Reporting Outlet: {selectedCluster.primary_article.source_name}
                </div>
                <a
                  href={selectedCluster.primary_article.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white text-sm hover:underline block mb-1"
                >
                  {selectedCluster.primary_article.title}
                </a>
                <p className="text-[#94a3b8]">{selectedCluster.primary_article.summary}</p>
              </div>

              {/* Related Publisher Coverage */}
              <div>
                <h4 className="font-semibold text-[#cbd5e1] mb-2 uppercase text-[11px] tracking-wider">
                  Corroborating Reports & Different Angles
                </h4>
                <div className="space-y-2">
                  {selectedCluster.related_articles.map((r, ri) => (
                    <div key={ri} className="p-3 rounded-xl bg-[#131926] border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-cyan-300">{r.source_name}</span>
                        <span className="text-[10px] text-[#64748b]">{formatRelativeTime(r.published_at)}</span>
                      </div>
                      <a
                        href={r.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-cyan-300 hover:underline font-medium block"
                      >
                        {r.title}
                      </a>
                      {r.summary && <p className="text-[#94a3b8]">{r.summary}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Ask AI About This Story --- */}
      {askAIModalOpen && activeStoryForAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl bg-[#0c101a] border border-[#38bdf8]/30 rounded-2xl shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-sm">Ask ANVESHA AI News Intelligence</span>
              </div>
              <button
                onClick={() => setAskAIModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-[#94a3b8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              {/* Target Story Card */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                {activeStoryForAI.image_url && (
                  <div className="relative w-full h-36 mb-2.5 rounded-lg overflow-hidden bg-slate-900 border border-white/5">
                    <img
                      src={activeStoryForAI.image_url}
                      alt={activeStoryForAI.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="text-[10px] font-mono text-[#8ab4f8] uppercase mb-1">
                  Target Story • {activeStoryForAI.source_name}
                </div>
                <div className="font-semibold text-white mb-1">{activeStoryForAI.title}</div>
                <p className="text-[#94a3b8]">{activeStoryForAI.summary}</p>
              </div>

              {/* Preset Prompts */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  'What are the key facts reported?',
                  'Are there conflicting reports?',
                  'What is the international significance?',
                ].map((pq, pqi) => (
                  <button
                    key={pqi}
                    onClick={() => handleSendAIQuestion(pq)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-[#cbd5e1] hover:text-white transition-colors"
                  >
                    {pq}
                  </button>
                ))}
              </div>

              {/* AI Answer Box */}
              {isAskingAI ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                  <span className="text-xs text-cyan-400 font-mono">Analyzing story reports...</span>
                </div>
              ) : aiAnswerData ? (
                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                  <div className="text-[11px] font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Intelligence Analysis</span>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {aiAnswerData.answer}
                  </div>
                  {aiAnswerData.sources.length > 0 && (
                    <div className="pt-2 border-t border-cyan-500/20 text-[11px] text-[#8ab4f8]">
                      <span>Source: {aiAnswerData.sources[0].source_name}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Question Input */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAIQuestion()}
                placeholder="Ask anything about this event..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#0e1320] border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={() => handleSendAIQuestion()}
                disabled={isAskingAI || !aiQuestion.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black transition-colors disabled:opacity-50"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
