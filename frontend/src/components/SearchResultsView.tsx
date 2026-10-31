import React, { useState, useEffect, useRef } from 'react';
import {
  FileCode,
  FolderCode,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  X,
  MapPin,
  Video,
  Navigation,
  Compass,
  Wind,
  Sun,
  SunMedium,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  CloudSnow
} from 'lucide-react';
import { voiceAssistant } from '../services/voiceAssistant';
import {
  SearchResponse,
  SearchResultItem,
  WebSearchResultItem,
  SearchMode,
  CitationItem,
  ChatMessage,
  SSEEvent,
  KnowledgePanelData,
  WeatherPanelData,
  MapPanelData,
  NewsArticle,
  ImageItem,
  NavigationalResultData,
} from '../types/api';
import { streamSearchV2, fetchSearchSuggestions, fetchVerticalSearch } from '../services/api';
import { FileViewerModal } from './FileViewerModal';
import { CodebaseToolsPanel } from './CodebaseToolsPanel';

// Google-Inspired Search Components
import { SearchResultsLayout } from './search/SearchResultsLayout';
import { SearchHeader } from './search/SearchHeader';
import { SearchNavigationTabs, SearchNavTabId } from './search/SearchNavigationTabs';
import { AIOverview } from './search/AIOverview';
import { OrganicResultsList } from './search/OrganicResultsList';
import { PeopleAlsoAsk } from './search/PeopleAlsoAsk';
import { KnowledgePanel } from './search/KnowledgePanel';
import { NavigationalResultCard } from './search/NavigationalResultCard';

interface SearchResultsViewProps {
  searchData: SearchResponse;
  activeConversationId?: string | null;
  onBackToSearch: () => void;
  onNewSearch: (query: string, mode?: SearchMode) => void;
  onOpenSettings?: () => void;
  onConversationCreated?: (id: string) => void;
}

function getRelatedQuestions(q: string): string[] {
  const lower = q.toLowerCase();
  if (lower.includes('delhi')) {
    return [
      'What is the best time to visit Delhi?',
      'How does the Delhi Metro system connect the National Capital Region?',
      'What is the historical significance of the Red Fort and Qutb Minar?',
      'What are the primary government institutions located in New Delhi?'
    ];
  }
  if (lower.includes('python')) {
    return [
      'How does the Python Global Interpreter Lock (GIL) affect multithreading?',
      'What are the key new performance features in Python 3.12 and 3.13?',
      'How do Python generators and iterators optimize memory usage?',
      'What is the difference between deepcopy and shallow copy in Python?'
    ];
  }
  if (lower.includes('useeffect') || lower.includes('react')) {
    return [
      'How do you properly clean up asynchronous operations in React useEffect?',
      'What is the difference between useEffect and useLayoutEffect?',
      'Why does React 18 execute useEffect twice in Strict Mode?',
      'When should you use custom hooks instead of raw useEffect calls?'
    ];
  }
  if (lower.includes('quantum')) {
    return [
      'What is a qubit and how does it differ from a classical bit?',
      'How does quantum superposition enable parallel computation?',
      'What is quantum entanglement and how is it used in cryptography?',
      'What are the primary hardware approaches for building quantum computers?'
    ];
  }
  if (lower.includes('intelligence') || lower.includes('ai')) {
    return [
      'What are the key differences between generative AI and traditional machine learning?',
      'How does retrieval-augmented generation (RAG) eliminate model hallucinations?',
      'What are the emerging trends in autonomous multi-agent systems?',
      'How do frontier AI models implement chain-of-thought extended reasoning?'
    ];
  }
  return [
    `How does ${q} work under the hood?`,
    `What are the best practices when implementing ${q}?`,
    `What are common pitfalls and security vulnerabilities related to ${q}?`,
    `How does ${q} compare to alternative modern architectures?`
  ];
}

function getRelatedSearches(q: string): string[] {
  const lower = q.toLowerCase();
  if (lower.includes('delhi')) {
    return ['Delhi weather today', 'Delhi tourist places', 'Delhi metro map', 'New Delhi history', 'Delhi population 2026'];
  }
  if (lower.includes('python')) {
    return ['Python 3.12 release notes', 'Python tutorial for beginners', 'Python vs Rust performance', 'Python web frameworks', 'Python async await'];
  }
  if (lower.includes('react') || lower.includes('useeffect')) {
    return ['React 19 new features', 'React useEffect cleanup function', 'React useMemo vs useCallback', 'Next.js 15 vs React', 'React server components'];
  }
  if (lower.includes('quantum')) {
    return ['Quantum computing vs classical', 'Superconducting qubits IBM', 'Quantum entanglement explained', 'Shor algorithm cryptography', 'Quantum programming Qiskit'];
  }
  if (lower.includes('ai') || lower.includes('intelligence')) {
    return ['Generative AI agents', 'Transformer architecture explained', 'DeepSeek vs Gemini benchmarks', 'RAG evaluation frameworks', 'Local LLM inference'];
  }
  return [`${q} documentation`, `${q} best practices`, `${q} tutorial`, `${q} architecture`, `${q} examples`];
}

function renderWeatherIcon(iconName?: string) {
  switch (iconName) {
    case 'Sun': return <Sun className="w-8 h-8 text-amber-400" />;
    case 'SunMedium': return <SunMedium className="w-8 h-8 text-amber-400" />;
    case 'CloudSun': return <CloudSun className="w-8 h-8 text-amber-300" />;
    case 'Cloud': return <Cloud className="w-8 h-8 text-slate-300" />;
    case 'CloudRain': return <CloudRain className="w-8 h-8 text-sky-400" />;
    case 'CloudLightning': return <CloudLightning className="w-8 h-8 text-yellow-400" />;
    case 'CloudFog': return <CloudFog className="w-8 h-8 text-slate-400" />;
    case 'CloudDrizzle': return <CloudDrizzle className="w-8 h-8 text-sky-300" />;
    case 'CloudSnow': return <CloudSnow className="w-8 h-8 text-cyan-200" />;
    default: return <Sun className="w-8 h-8 text-amber-400" />;
  }
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  searchData,
  activeConversationId,
  onBackToSearch,
  onNewSearch,
  onOpenSettings,
  onConversationCreated,
}) => {
  // Navigation tabs in results view
  const [searchNavTab, setSearchNavTab] = useState<SearchNavTabId>('all');

  // Query & Mode state
  const [headerQuery, setHeaderQuery] = useState(searchData.query);
  const [currentMode, setCurrentMode] = useState<SearchMode>(searchData.mode_requested || 'auto');

  // AI Streaming State
  const [aiAnswer, setAiAnswer] = useState<string>(searchData.initial_answer || '');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [citations, setCitations] = useState<CitationItem[]>([]);
  const [streamingError, setStreamingError] = useState<string | null>(null);

  // Search Results state
  const [codeResults, setCodeResults] = useState<SearchResultItem[]>(searchData.results);
  const [webResults, setWebResults] = useState<WebSearchResultItem[]>(searchData.web_results || []);
  const [navigationalResult, setNavigationalResult] = useState<NavigationalResultData | null>(searchData.navigational_result || null);
  const [suggestedCorrection, setSuggestedCorrection] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [webError, setWebError] = useState<string | null>(searchData.web_error || null);
  const [modeUsed, setModeUsed] = useState<string>(searchData.mode_used || 'code');
  const [providerUsed, setProviderUsed] = useState<string | null>(searchData.provider_used || null);
  const [modelUsed, setModelUsed] = useState<string | null>(searchData.model_used || null);

  // Specialized Information Panels
  const [knowledgePanel, setKnowledgePanel] = useState<KnowledgePanelData | null>(null);
  const [weather, setWeather] = useState<WeatherPanelData | null>(null);
  const [mapData, setMapData] = useState<MapPanelData | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);

  // Search suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Voice Search State
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  useEffect(() => {
    return voiceAssistant.subscribe((s) => setIsSpeaking(s.isSpeaking));
  }, []);

  // Lightbox Image
  const [lightboxImage, setLightboxImage] = useState<ImageItem | null>(null);

  // Conversation history for multi-turn follow-ups
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>(searchData.initial_conversation || []);

  // Code results filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'symbol' | 'filename' | 'content'>('all');

  // File Viewer Modal state
  const [inspectFile, setInspectFile] = useState<{ path: string; line: number } | null>(null);

  // Abort controller ref for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Run initial AI streaming synthesis on mount for this query (unless preloaded from history)
  useEffect(() => {
    if (searchData.initial_answer) {
      setAiAnswer(searchData.initial_answer);
      if (searchData.initial_conversation) {
        setConversationHistory(searchData.initial_conversation);
      }
    } else {
      runStreamingSearch(searchData.query, searchData.mode_requested || 'auto');
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchData.query, searchData.initial_answer]);

  // Debounced search suggestions
  useEffect(() => {
    let isCurrent = true;
    if (!headerQuery || headerQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const suggs = await fetchSearchSuggestions(headerQuery.trim());
        if (isCurrent) {
          setSuggestions(Array.isArray(suggs) ? suggs : []);
        }
      } catch (err) {
        if (isCurrent) {
          setSuggestions([]);
        }
      }
    }, 250);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [headerQuery]);

  const runStreamingSearch = async (
    queryText: string,
    mode: SearchMode,
    history: ChatMessage[] = []
  ) => {
    if (!queryText.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setStreamingError(null);
    setAiAnswer('');
    setCitations([]);
    setKnowledgePanel(null);
    setNavigationalResult(null);
    setSuggestedCorrection(null);
    setCurrentPage(1);
    setHasMore(true);
    setIsLoadingMore(false);
    setWeather(null);
    setMapData(null);
    setImages([]);
    setNewsArticles([]);
    setCurrentPhase('initializing');
    setStatusMessage('Searching web & verifying grounded sources...');

    let fullAnswer = '';

    try {
      await streamSearchV2(
        queryText.trim(),
        mode,
        history,
        (event: SSEEvent) => {
          switch (event.event) {
            case 'search_started':
              if (event.data.conversation_id && onConversationCreated) {
                onConversationCreated(event.data.conversation_id);
              }
              if (event.data.provider) setProviderUsed(event.data.provider);
              if (event.data.model) setModelUsed(event.data.model);
              break;
            case 'query_intel':
              if (event.data?.has_typo && event.data?.suggested_correction) {
                setSuggestedCorrection(event.data.suggested_correction);
              }
              break;
            case 'status':
              setCurrentPhase(event.data.phase);
              setStatusMessage(event.data.message);
              break;
            case 'sources':
              setCodeResults(event.data.code_results || []);
              setWebResults(event.data.web_results || []);
              setNavigationalResult(event.data.navigational_result || null);
              setWebError(event.data.web_error || null);
              setModeUsed(event.data.mode_used);
              if (event.data.suggested_correction) {
                setSuggestedCorrection(event.data.suggested_correction);
              }
              break;
            case 'specialized_panels':
              if (event.data.knowledge_panel) setKnowledgePanel(event.data.knowledge_panel);
              if (event.data.weather) setWeather(event.data.weather);
              if (event.data.map) setMapData(event.data.map);
              if (event.data.images && event.data.images.length > 0) setImages(event.data.images);
              if (event.data.news && event.data.news.length > 0) setNewsArticles(event.data.news);
              break;
            case 'citations':
              setCitations(event.data || []);
              break;
            case 'answer_chunk':
              fullAnswer += event.data.delta;
              setAiAnswer(fullAnswer);
              break;
            case 'completed':
              setIsStreaming(false);
              setStatusMessage('');
              if (event.data.conversation_id && onConversationCreated) {
                onConversationCreated(event.data.conversation_id);
              }
              if (event.data.provider_used) setProviderUsed(event.data.provider_used);
              if (event.data.model_used) setModelUsed(event.data.model_used);
              if (event.data.mode_used) setModeUsed(event.data.mode_used);
              setConversationHistory((prev) => [
                ...prev,
                { role: 'user', content: queryText },
                { role: 'assistant', content: fullAnswer },
              ]);
              break;
            case 'error':
              setStreamingError(event.data.message);
              setIsStreaming(false);
              break;
          }
        },
        controller.signal,
        activeConversationId
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatusMessage('Generation stopped by user.');
      } else {
        const msg = err instanceof Error ? err.message : 'Streaming search failed.';
        setStreamingError(msg);
      }
      setIsStreaming(false);
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  };

  const handleRetryStreaming = () => {
    runStreamingSearch(headerQuery, currentMode, conversationHistory);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const res = await fetchVerticalSearch(
        headerQuery,
        searchNavTab === 'news' ? 'news' : 'general',
        nextPage,
        10
      );
      if (res.results && res.results.length > 0) {
        setWebResults((prev) => {
          const seen = new Set(prev.map((r) => r.url));
          const newItems = res.results.filter((r) => !seen.has(r.url));
          return [...prev, ...newItems];
        });
        setCurrentPage(nextPage);
        setHasMore(res.has_more !== false && res.results.length > 0);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more results:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleHeaderSearchSubmit = (q: string, m?: SearchMode) => {
    setShowSuggestions(false);
    const searchTarget = q.trim() || headerQuery.trim();
    if (searchTarget) {
      setHeaderQuery(searchTarget);
      const chosenMode = m || currentMode;
      onNewSearch(searchTarget, chosenMode);
      runStreamingSearch(searchTarget, chosenMode, []);
    }
  };

  const handleClearQuery = () => {
    setHeaderQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Web Speech API Voice Search
  const handleToggleVoice = () => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotification('Voice search requires a Chromium or Safari browser with microphone access.');
      setTimeout(() => setVoiceNotification(null), 4500);
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        setVoiceNotification('Listening... Speak now.');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setHeaderQuery(transcript);
        if (event.results[0].isFinal) {
          setIsListeningVoice(false);
          setVoiceNotification(null);
          onNewSearch(transcript, currentMode);
          runStreamingSearch(transcript, currentMode, []);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListeningVoice(false);
        setVoiceNotification(`Voice error: ${event.error || 'Microphone unavailable'}`);
        setTimeout(() => setVoiceNotification(null), 4000);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (err: any) {
      setIsListeningVoice(false);
      setVoiceNotification('Could not initialize microphone.');
      setTimeout(() => setVoiceNotification(null), 4000);
    }
  };

  const handleFollowUpSubmit = (question: string) => {
    if (!question.trim() || isStreaming) return;
    setHeaderQuery(question);

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: question },
    ];
    setConversationHistory(updatedHistory);
    runStreamingSearch(question, currentMode, updatedHistory);
  };

  const filteredCodeResults = codeResults.filter((r) => {
    if (activeFilter === 'all') return true;
    return r.match_type === activeFilter;
  });

  // Secondary Column: Knowledge Panel, Weather, Maps, Media Gallery Preview
  const renderSecondaryColumn = () => {
    const hasSecondaryContent = knowledgePanel || mapData || weather || images.length > 0;
    if (!hasSecondaryContent) return null;

    return (
      <div className="space-y-4">
        {/* 1. Knowledge Panel */}
        {knowledgePanel && <KnowledgePanel data={knowledgePanel} />}

        {/* 2. Interactive Map Preview Card */}
        {mapData && (
          <div className="p-4 rounded-2xl bg-[#282a2c] border border-[#3c4043] space-y-3 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-medium text-[#e8eaed]">{mapData.location_name}</h4>
              </div>
              <a
                href={mapData.directions_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-full bg-[#303134] hover:bg-[#3c4043] text-[#8ab4f8] text-xs font-sans flex items-center gap-1 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                <span>Directions</span>
              </a>
            </div>

            <div className="w-full h-44 rounded-xl overflow-hidden border border-[#3c4043]">
              <iframe
                src={mapData.embed_url}
                title={mapData.location_name}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* 3. Weather Card */}
        {weather && (
          <div className="p-4 rounded-2xl bg-[#282a2c] border border-[#3c4043] space-y-2 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#bdc1c6]">
                <Compass className="w-3.5 h-3.5 text-[#8ab4f8]" />
                <span className="font-medium text-[#e8eaed]">{weather.location_name}</span>
              </div>
              <span className="text-[11px] text-[#9aa0a6]">Weather</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                {renderWeatherIcon(weather.condition_icon)}
                <div>
                  <div className="text-2xl font-sans font-medium text-[#e8eaed]">
                    {weather.temperature_c}°C
                  </div>
                  <span className="text-xs text-[#bdc1c6]">{weather.condition}</span>
                </div>
              </div>

              <div className="text-right text-xs text-[#bdc1c6] space-y-0.5">
                <div className="flex items-center gap-1 justify-end">
                  <Wind className="w-3.5 h-3.5 text-[#9aa0a6]" />
                  <span>{weather.wind_speed_kmh} km/h</span>
                </div>
                <span className="text-[10px] text-[#9aa0a6] block">{weather.attribution || 'Open-Meteo'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Media Gallery Preview */}
        {images.length > 0 && (
          <div className="p-4 rounded-2xl bg-[#282a2c] border border-[#3c4043] space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#e8eaed]">Images</span>
              <button
                type="button"
                onClick={() => setSearchNavTab('images')}
                className="text-xs text-[#8ab4f8] hover:underline"
              >
                View all ({images.length})
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {images.slice(0, 3).map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxImage(img)}
                  className="aspect-square rounded-lg bg-[#202124] border border-[#3c4043] overflow-hidden cursor-pointer group"
                >
                  <img
                    src={img.thumbnail_url || img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <SearchResultsLayout
      header={
        <SearchHeader
          query={headerQuery}
          onQueryChange={setHeaderQuery}
          onSubmit={handleHeaderSearchSubmit}
          onClear={handleClearQuery}
          onBackToSearch={onBackToSearch}
          currentMode={currentMode}
          onModeChange={setCurrentMode}
          isStreaming={isStreaming}
          isListeningVoice={isListeningVoice}
          onToggleVoice={handleToggleVoice}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          onSelectSuggestion={(sugg) => {
            setHeaderQuery(sugg);
            handleHeaderSearchSubmit(sugg);
          }}
          onCloseSuggestions={() => setShowSuggestions(false)}
          isSpeaking={isSpeaking}
          onToggleSpeech={() => {
            if (isSpeaking) {
              voiceAssistant.stopSpeaking();
            } else if (aiAnswer) {
              voiceAssistant.speak(aiAnswer);
            }
          }}
          onOpenSettings={onOpenSettings}
        />
      }
      navigationTabs={
        <SearchNavigationTabs
          activeTab={searchNavTab}
          onSelectTab={setSearchNavTab}
          hasImages={images.length > 0}
          hasNews={newsArticles.length > 0}
          hasMap={Boolean(mapData)}
          hasCode={codeResults.length > 0}
        />
      }
      secondaryColumn={searchNavTab === 'all' ? renderSecondaryColumn() : undefined}
    >
      {/* Voice Notification Banner */}
      {voiceNotification && (
        <div className="mb-4 p-3 rounded-xl bg-[#282a2c] border border-[#3c4043] text-[#e8eaed] text-xs font-sans flex items-center justify-between">
          <span>{voiceNotification}</span>
          <button onClick={() => setVoiceNotification(null)} className="text-[#9aa0a6] hover:text-[#e8eaed]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Streaming Error Banner */}
      {streamingError && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-200 text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{streamingError}</span>
          </div>
          <button
            onClick={handleRetryStreaming}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* VIEW A: Images Category View */}
      {searchNavTab === 'images' && (
        <div className="space-y-4 max-w-full">
          <div className="flex items-center justify-between border-b border-[#3c4043] pb-3">
            <h3 className="text-base font-normal text-[#e8eaed]">
              Images ({images.length})
            </h3>
            <span className="text-xs text-[#9aa0a6]">Wikimedia Commons (CC BY-SA)</span>
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxImage(img)}
                  className="rounded-xl bg-[#282a2c] border border-[#3c4043] overflow-hidden cursor-pointer aspect-video relative group"
                >
                  <img
                    src={img.thumbnail_url || img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                    <p className="text-xs text-[#e8eaed] truncate">{img.title}</p>
                    <span className="text-[10px] text-[#bdc1c6]">{img.source_domain}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#9aa0a6] text-sm">
              No open-licensed images found for this query.
            </div>
          )}
        </div>
      )}

      {/* VIEW B: News Category View */}
      {searchNavTab === 'news' && (
        <div className="space-y-4 max-w-[652px]">
          <div className="flex items-center justify-between border-b border-[#3c4043] pb-3">
            <h3 className="text-base font-normal text-[#e8eaed]">
              News Articles ({newsArticles.length})
            </h3>
          </div>

          {newsArticles.length > 0 ? (
            <div className="space-y-4">
              {newsArticles.map((art, idx) => (
                <div
                  key={idx}
                  className="py-3 border-b border-[#3c4043]/50 text-left space-y-1"
                >
                  <div className="text-xs text-[#9aa0a6] flex items-center gap-2">
                    <span className="font-medium text-[#bdc1c6]">{art.source}</span>
                    <span>&bull;</span>
                    <span>{art.published_at}</span>
                  </div>
                  <h4 className="text-base font-normal">
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8ab4f8] hover:underline block leading-snug"
                    >
                      {art.title}
                    </a>
                  </h4>
                  <p className="text-xs text-[#bdc1c6] leading-relaxed">{art.snippet}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#9aa0a6] text-sm">
              No recent news articles found for this topic.
            </div>
          )}
        </div>
      )}

      {/* VIEW C: Maps Category View */}
      {searchNavTab === 'maps' && (
        <div className="space-y-4 max-w-[800px]">
          {mapData ? (
            <div className="rounded-2xl bg-[#282a2c] border border-[#3c4043] overflow-hidden p-4 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium text-[#e8eaed]">{mapData.location_name}</h4>
                  <span className="text-xs text-[#9aa0a6]">
                    {mapData.latitude.toFixed(4)}° N, {mapData.longitude.toFixed(4)}° E
                  </span>
                </div>
                <a
                  href={mapData.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full bg-[#8ab4f8] text-[#202124] font-medium text-xs font-sans flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Get Directions</span>
                </a>
              </div>
              <div className="w-full h-[500px] rounded-xl overflow-hidden border border-[#3c4043]">
                <iframe
                  src={mapData.embed_url}
                  title={mapData.location_name}
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-[#9aa0a6] text-sm">
              Geographic map is available for location queries (e.g. "Delhi", "London", "Tokyo").
            </div>
          )}
        </div>
      )}

      {/* VIEW D: Videos Category View */}
      {searchNavTab === 'videos' && (
        <div className="py-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#303134] text-[#9aa0a6] flex items-center justify-center mx-auto">
            <Video className="w-5 h-5" />
          </div>
          <h3 className="text-base font-medium text-[#e8eaed]">Video Provider Not Configured</h3>
          <p className="text-xs text-[#bdc1c6] leading-relaxed">
            ANVESHA does not fabricate video search results. To enable video search, connect a YouTube Data API v3 key in Platform Settings.
          </p>
        </div>
      )}

      {/* VIEW E: Code Category View */}
      {searchNavTab === 'code' && (
        <div className="space-y-4 max-w-[652px] text-left">
          <div className="flex items-center justify-between border-b border-[#3c4043] pb-3">
            <h3 className="text-base font-normal text-[#e8eaed]">
              Code Matches ({codeResults.length})
            </h3>
            <div className="flex items-center gap-1 text-xs">
              {(['all', 'symbol', 'filename', 'content'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-2.5 py-1 rounded-full capitalize transition-colors ${
                    activeFilter === f
                      ? 'bg-[#303134] text-[#8ab4f8] border border-[#3c4043]'
                      : 'text-[#9aa0a6] hover:text-[#e8eaed]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredCodeResults.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#282a2c] border border-[#3c4043] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setInspectFile({ path: item.relative_path, line: item.line_number })}
                    className="font-medium text-[#8ab4f8] hover:underline truncate flex items-center gap-2 cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.relative_path}:{item.line_number}</span>
                  </button>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#303134] text-[#bdc1c6]">
                    {item.match_type}
                  </span>
                </div>
                <div
                  onClick={() => setInspectFile({ path: item.relative_path, line: item.line_number })}
                  className="p-2.5 rounded-lg bg-[#202124] border border-[#3c4043] font-mono text-xs text-[#e8eaed] overflow-x-auto cursor-pointer"
                >
                  <code>{item.snippet}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW F: Tools Category View */}
      {searchNavTab === 'tools' && (
        <div className="max-w-[800px]">
          <CodebaseToolsPanel
            onOpenFile={(path, line) => setInspectFile({ path, line: line || 1 })}
          />
        </div>
      )}

      {/* VIEW G: Primary Search Results (Tab 'all', 'ai_overview', or 'deep') */}
      {(searchNavTab === 'all' || searchNavTab === 'ai_overview' || searchNavTab === 'deep') && (
        <>
          {/* Typo Correction / Did You Mean Suggestion */}
          {suggestedCorrection && (
            <div className="mb-4 text-left text-sm font-sans text-[#bdc1c6] max-w-[652px]">
              <span>Did you mean: </span>
              <button
                type="button"
                onClick={() => {
                  setHeaderQuery(suggestedCorrection);
                  handleHeaderSearchSubmit(suggestedCorrection);
                }}
                className="text-[#8ab4f8] hover:underline italic font-medium cursor-pointer"
              >
                {suggestedCorrection}
              </button>
            </div>
          )}

          {/* 1. AI Overview Box (Primary Position) */}
          <AIOverview
            answer={aiAnswer}
            isStreaming={isStreaming}
            statusMessage={statusMessage}
            currentPhase={currentPhase}
            citations={citations}
            isSpeaking={isSpeaking}
            onToggleSpeech={() => {
              if (isSpeaking) {
                voiceAssistant.stopSpeaking();
              } else if (aiAnswer) {
                voiceAssistant.speak(aiAnswer);
              }
            }}
            onStopStreaming={handleStopStreaming}
            onRetryStreaming={handleRetryStreaming}
            onFollowUp={handleFollowUpSubmit}
            onCodeClick={(path, line) => setInspectFile({ path, line: line || 1 })}
            providerUsed={providerUsed}
            modelUsed={modelUsed}
            modeUsed={modeUsed}
          />

          {/* 2. Official Website / Primary Navigational Card (When relevant) */}
          {searchNavTab !== 'ai_overview' && navigationalResult && (
            <NavigationalResultCard result={navigationalResult} />
          )}

          {/* 3. Organic Web Results List with Pagination */}
          {searchNavTab !== 'ai_overview' && webResults.length > 0 && (
            <OrganicResultsList
              results={webResults}
              onLoadMore={handleLoadMore}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
            />
          )}

          {/* Web Error / Notice (If external search fails but AI or other results exist) */}
          {searchNavTab !== 'ai_overview' && webError && webResults.length === 0 && !navigationalResult && (
            <div className="py-6 text-sm text-[#bdc1c6] max-w-[652px]">
              Web search notification: {webError}
            </div>
          )}

          {/* 4. People Also Ask (Only if questions are available) */}
          {searchNavTab === 'all' && (
            <PeopleAlsoAsk
              questions={getRelatedQuestions(headerQuery)}
              onSelectQuestion={(q) => {
                setHeaderQuery(q);
                handleHeaderSearchSubmit(q);
              }}
            />
          )}

          {/* 4. Code Matches Summary (if in 'all' mode and codebase matches found) */}
          {searchNavTab === 'all' && codeResults.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#3c4043] space-y-3 text-left max-w-[652px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderCode className="w-4 h-4 text-[#8ab4f8]" />
                  <h4 className="text-base font-normal text-[#e8eaed]">
                    Repository Matches ({codeResults.length})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchNavTab('code')}
                  className="text-xs text-[#8ab4f8] hover:underline"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {codeResults.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setInspectFile({ path: item.relative_path, line: item.line_number })}
                    className="p-3 rounded-xl bg-[#282a2c] hover:bg-[#303134] border border-[#3c4043] cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <span className="font-mono text-[#8ab4f8] truncate">
                      {item.relative_path}:{item.line_number}
                    </span>
                    <span className="text-[#9aa0a6] text-[11px] shrink-0 capitalize">{item.match_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Related Searches Pills */}
          {searchNavTab === 'all' && (
            <div className="mt-8 pt-6 border-t border-[#3c4043] space-y-3 text-left max-w-[652px]">
              <span className="text-sm font-medium text-[#e8eaed] block">Related searches</span>
              <div className="flex flex-wrap gap-2">
                {getRelatedSearches(headerQuery).map((rs, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setHeaderQuery(rs);
                      handleHeaderSearchSubmit(rs);
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#282a2c] hover:bg-[#303134] border border-[#3c4043] text-xs font-sans text-[#bdc1c6] hover:text-[#e8eaed] transition-colors cursor-pointer"
                  >
                    {rs}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 6. Pagination Controls (Google style numbered pagination) */}
          {searchNavTab === 'all' && webResults.length > 0 && (
            <div className="flex items-center gap-2 pt-10 pb-6 max-w-[652px]">
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-[#8ab4f8] text-[#202124] font-medium text-sm flex items-center justify-center font-sans"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleHeaderSearchSubmit(`${headerQuery} page 2`)}
                className="w-9 h-9 rounded-full hover:bg-[#303134] text-[#bdc1c6] hover:text-[#e8eaed] text-sm flex items-center justify-center font-sans transition-colors cursor-pointer"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleHeaderSearchSubmit(`${headerQuery} page 3`)}
                className="w-9 h-9 rounded-full hover:bg-[#303134] text-[#bdc1c6] hover:text-[#e8eaed] text-sm flex items-center justify-center font-sans transition-colors cursor-pointer"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleHeaderSearchSubmit(`${headerQuery} next`)}
                className="px-4 py-2 rounded-full hover:bg-[#303134] text-[#8ab4f8] text-sm font-medium transition-colors cursor-pointer ml-2"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-3xl w-full bg-[#282a2c] border border-[#3c4043] rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-left">
              <h4 className="text-sm font-medium text-[#e8eaed] truncate">{lightboxImage.title}</h4>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full max-h-[65vh] rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#9aa0a6] pt-2 border-t border-[#3c4043]">
              <span>Source: {lightboxImage.source_domain}</span>
              {lightboxImage.source_url && (
                <a
                  href={lightboxImage.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8ab4f8] hover:underline flex items-center gap-1"
                >
                  <span>View Original</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {inspectFile && (
        <FileViewerModal
          filePath={inspectFile.path}
          targetLineNumber={inspectFile.line}
          onClose={() => setInspectFile(null)}
        />
      )}
    </SearchResultsLayout>
  );
};
