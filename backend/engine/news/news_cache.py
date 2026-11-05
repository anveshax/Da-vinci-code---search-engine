"""
News Cache and Persistence Engine for ANVESHA.
Maintains in-memory high-speed cache with SQLite persistent storage backing in intelligence.db.
"""
import json
import sqlite3
import time
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from app.core.db import get_db_connection
from .models import NewsArticle, StoryCluster


class NewsCache:
    def __init__(self, memory_ttl_sec: int = 300):
        self.memory_ttl_sec = memory_ttl_sec
        self._articles_cache: List[NewsArticle] = []
        self._clusters_cache: List[StoryCluster] = []
        self._last_memory_update: float = 0.0
        self.init_sqlite_schema()

    def init_sqlite_schema(self):
        """Ensures SQLite schema for news persistence exists."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS news_articles (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    original_url TEXT UNIQUE NOT NULL,
                    source_name TEXT NOT NULL,
                    source_domain TEXT,
                    category TEXT NOT NULL,
                    country TEXT NOT NULL,
                    language TEXT NOT NULL,
                    published_at TEXT NOT NULL,
                    summary TEXT,
                    image_url TEXT,
                    provider TEXT NOT NULL,
                    outlets_count INTEGER DEFAULT 1,
                    reliability_score REAL DEFAULT 0.8,
                    cluster_id TEXT,
                    is_breaking INTEGER DEFAULT 0,
                    raw_metadata TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_pub ON news_articles(published_at DESC);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_cat ON news_articles(category);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_country ON news_articles(country);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_lang ON news_articles(language);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_cluster ON news_articles(cluster_id);")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS news_source_health (
                    source_id TEXT PRIMARY KEY,
                    source_name TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    status TEXT NOT NULL,
                    last_success_at TEXT,
                    last_attempt_at TEXT,
                    consecutive_failures INTEGER DEFAULT 0,
                    response_time_ms REAL DEFAULT 0,
                    error_message TEXT
                );
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            print("NewsCache SQLite schema init warning:", e)

    def is_memory_fresh(self) -> bool:
        return (time.time() - self._last_memory_update) < self.memory_ttl_sec and len(self._articles_cache) > 0

    def get_memory_articles(self) -> List[NewsArticle]:
        return list(self._articles_cache)

    def get_memory_clusters(self) -> List[StoryCluster]:
        return list(self._clusters_cache)

    def set_memory_cache(self, articles: List[NewsArticle], clusters: List[StoryCluster]):
        self._articles_cache = articles
        self._clusters_cache = clusters
        self._last_memory_update = time.time()
        # Persist top fresh articles into SQLite asynchronously/safely
        self.persist_articles_to_db(articles)

    def persist_articles_to_db(self, articles: List[NewsArticle]):
        """Persists or updates articles in SQLite."""
        if not articles:
            return
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            for art in articles[:100]:
                cursor.execute("""
                    INSERT INTO news_articles (
                        id, title, original_url, source_name, source_domain,
                        category, country, language, published_at, summary,
                        image_url, provider, outlets_count, reliability_score,
                        cluster_id, is_breaking, raw_metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(original_url) DO UPDATE SET
                        outlets_count = excluded.outlets_count,
                        reliability_score = excluded.reliability_score,
                        cluster_id = excluded.cluster_id,
                        raw_metadata = excluded.raw_metadata;
                """, (
                    art.id, art.title, art.original_url, art.source_name, art.source_domain,
                    art.category, art.country, art.language, art.published_at, art.summary,
                    art.image_url, art.provider, art.outlets_count, art.reliability_score,
                    art.cluster_id, 1 if art.is_breaking else 0, json.dumps(art.raw_metadata or {})
                ))
            conn.commit()
            conn.close()
        except Exception as e:
            print("NewsCache persist error:", e)

    def query_db(
        self,
        query: Optional[str] = None,
        country: Optional[str] = None,
        language: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 30,
        offset: int = 0
    ) -> List[NewsArticle]:
        """Queries persisted articles from SQLite with filters."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            sql = "SELECT * FROM news_articles WHERE 1=1"
            params: List[Any] = []

            if country and country.upper() != "WORLD":
                sql += " AND country = ?"
                params.append(country.upper())
            if language and language.lower() != "all":
                sql += " AND language = ?"
                params.append(language.lower())
            if category and category.lower() not in ("all", "top"):
                sql += " AND category = ?"
                params.append(category.lower())
            if query and query.strip():
                sql += " AND (title LIKE ? OR summary LIKE ?)"
                kw = f"%{query.strip()}%"
                params.extend([kw, kw])

            sql += " ORDER BY published_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(sql, params)
            rows = cursor.fetchall()
            conn.close()

            articles: List[NewsArticle] = []
            for r in rows:
                articles.append(NewsArticle(
                    id=r["id"],
                    title=r["title"],
                    original_url=r["original_url"],
                    source_name=r["source_name"],
                    source_domain=r["source_domain"] or "",
                    category=r["category"],
                    country=r["country"],
                    language=r["language"],
                    published_at=r["published_at"],
                    summary=r["summary"] or "",
                    image_url=r["image_url"],
                    provider=r["provider"],
                    outlets_count=r["outlets_count"],
                    reliability_score=r["reliability_score"],
                    cluster_id=r["cluster_id"],
                    is_breaking=bool(r["is_breaking"]),
                    raw_metadata=json.loads(r["raw_metadata"]) if r["raw_metadata"] else {},
                ))
            return articles
        except Exception as e:
            print("NewsCache query_db error:", e)
            return []

    def get_last_updated_timestamp(self) -> str:
        if self._last_memory_update > 0:
            return datetime.fromtimestamp(self._last_memory_update, tz=timezone.utc).isoformat()
        return datetime.now(timezone.utc).isoformat()
