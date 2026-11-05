"""
Data models and schemas for ANVESHA Worldwide News Aggregation Platform.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class NewsArticle(BaseModel):
    id: str
    title: str
    original_url: str
    source_name: str
    source_domain: str = ""
    category: str = "general"
    country: str = "WORLD"
    language: str = "en"
    published_at: str
    summary: str = ""
    image_url: Optional[str] = None
    provider: str  # 'worldpulse' | 'actually_relevant' | 'rss' | 'freshrss'
    outlets_count: int = 1
    reliability_score: float = 0.8
    cluster_id: Optional[str] = None
    is_breaking: bool = False
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)


class StoryCluster(BaseModel):
    cluster_id: str
    title: str
    primary_article: NewsArticle
    related_articles: List[NewsArticle] = Field(default_factory=list)
    outlets_count: int = 1
    participating_sources: List[str] = Field(default_factory=list)
    key_facts: List[str] = Field(default_factory=list)
    conflicting_claims: List[str] = Field(default_factory=list)
    category: str = "general"
    country: str = "WORLD"
    language: str = "en"
    updated_at: str


class ProviderHealth(BaseModel):
    source_id: str
    source_name: str
    provider: str
    status: str = "healthy"  # 'healthy' | 'degraded' | 'down'
    last_success_at: Optional[str] = None
    last_attempt_at: Optional[str] = None
    consecutive_failures: int = 0
    response_time_ms: float = 0.0
    error_message: Optional[str] = None


class NewsQuery(BaseModel):
    query: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    category: Optional[str] = None
    publisher: Optional[str] = None
    sort: str = "latest"  # 'latest' | 'relevance'
    page: int = 1
    limit: int = 25


class DailyBriefingResponse(BaseModel):
    title: str
    date: str
    summary: str
    key_events: List[Dict[str, Any]] = Field(default_factory=list)
    sources: List[Dict[str, str]] = Field(default_factory=list)
    disclaimer: str = "AI-generated synthesis based on multi-source verified public reports."


class AskAIStoryResponse(BaseModel):
    story_id: str
    story_title: str
    answer: str
    verified_facts: List[str] = Field(default_factory=list)
    conflicting_or_unconfirmed: List[str] = Field(default_factory=list)
    sources: List[Dict[str, str]] = Field(default_factory=list)
