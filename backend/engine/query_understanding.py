"""
ANVESHA Query Understanding & Intelligence Engine.

Performs:
1. Search operator parsing (site:, filetype:, -exclude, "exact phrase", time/date filters).
2. Intent classification (navigational, informational, technical, news, academic, transactional).
3. Typographical error correction and 'Did you mean?' suggestions.
4. Entity recognition and disambiguation (tech platforms, languages, frameworks, institutions).
5. Clean query transformation for upstream search engines and hybrid indexers.
"""
import re
from typing import Dict, List, Optional, Any, Set
from pydantic import BaseModel, Field


class ParsedSearchOperators(BaseModel):
    """Structured extraction of Google-style search operators."""
    exact_phrases: List[str] = Field(default_factory=list)
    excluded_terms: List[str] = Field(default_factory=list)
    site_restrictions: List[str] = Field(default_factory=list)
    filetype_restrictions: List[str] = Field(default_factory=list)
    time_filter: Optional[str] = None  # 'day', 'week', 'month', 'year'
    clean_query: str = ""


class QueryUnderstandingResult(BaseModel):
    """Complete semantic and syntactic analysis of a search query."""
    raw_query: str
    clean_query: str
    intent: str  # 'navigational' | 'informational' | 'technical' | 'news' | 'academic' | 'transactional'
    confidence: float
    operators: ParsedSearchOperators
    suggested_correction: Optional[str] = None
    has_typo: bool = False
    recognized_entities: List[Dict[str, str]] = Field(default_factory=list)
    is_navigational: bool = False
    target_platform: Optional[str] = None


# Common typographical errors and corrections
COMMON_TYPOS: Dict[str, str] = {
    "whatsap": "whatsapp",
    "whatsap web": "whatsapp web",
    "whattsapp": "whatsapp",
    "watsapp": "whatsapp",
    "whatapp": "whatsapp",
    "gthub": "github",
    "githb": "github",
    "githup": "github",
    "git hub": "github",
    "facebok": "facebook",
    "facbook": "facebook",
    "fb": "facebook",
    "instgram": "instagram",
    "insta": "instagram",
    "yt": "youtube",
    "youtub": "youtube",
    "pythn": "python",
    "pyhton": "python",
    "javscript": "javascript",
    "js": "javascript",
    "ts": "typescript",
    "typscript": "typescript",
    "reactjs": "react",
    "rect": "react",
    "kubernets": "kubernetes",
    "k8s": "kubernetes",
    "dockr": "docker",
    "artifical intelligence": "artificial intelligence",
    "artifitial intelligence": "artificial intelligence",
    "ai": "artificial intelligence",
    "machne learning": "machine learning",
    "ml": "machine learning",
    "quantm computing": "quantum computing",
}

# Known entity dictionary for entity recognition
KNOWN_ENTITIES: Dict[str, Dict[str, str]] = {
    "whatsapp": {"type": "Platform / Application", "domain": "whatsapp.com", "name": "WhatsApp"},
    "facebook": {"type": "Social Network", "domain": "facebook.com", "name": "Facebook"},
    "instagram": {"type": "Social Media Platform", "domain": "instagram.com", "name": "Instagram"},
    "github": {"type": "Developer Platform / Code Host", "domain": "github.com", "name": "GitHub"},
    "youtube": {"type": "Video Platform", "domain": "youtube.com", "name": "YouTube"},
    "python": {"type": "Programming Language", "domain": "python.org", "name": "Python"},
    "react": {"type": "JavaScript UI Library", "domain": "react.dev", "name": "React"},
    "fastapi": {"type": "Python Web Framework", "domain": "fastapi.tiangolo.com", "name": "FastAPI"},
    "docker": {"type": "Containerization Platform", "domain": "docker.com", "name": "Docker"},
    "kubernetes": {"type": "Container Orchestration Engine", "domain": "kubernetes.io", "name": "Kubernetes"},
    "mit": {"type": "University / Research Institution", "domain": "mit.edu", "name": "MIT"},
    "stanford": {"type": "University / Research Institution", "domain": "stanford.edu", "name": "Stanford University"},
    "harvard": {"type": "University / Research Institution", "domain": "harvard.edu", "name": "Harvard University"},
    "google": {"type": "Technology Corporation", "domain": "google.com", "name": "Google"},
    "microsoft": {"type": "Technology Corporation", "domain": "microsoft.com", "name": "Microsoft"},
}


class QueryUnderstandingEngine:
    """
    World-class query parser, operator extractor, typo corrector,
    and intent classifier for ANVESHA.
    """

    def parse_operators(self, raw_query: str) -> ParsedSearchOperators:
        """
        Extracts Google-style operators:
        - "exact phrase"
        - site:domain.com
        - filetype:pdf / ext:pdf
        - -exclude_term
        - time:day / time:week / time:month
        """
        operators = ParsedSearchOperators()
        text = raw_query

        # 1. Exact phrase quotes ("...")
        phrases = re.findall(r'"([^"]+)"', text)
        operators.exact_phrases = [p.strip() for p in phrases if p.strip()]
        text = re.sub(r'"[^"]+"', ' ', text)

        # 2. Site restrictions (site:example.com)
        site_matches = re.findall(r'\bsite:([a-zA-Z0-9.\-]+)', text, re.IGNORECASE)
        operators.site_restrictions = [s.lower().strip() for s in site_matches]
        text = re.sub(r'\bsite:[a-zA-Z0-9.\-]+', ' ', text, flags=re.IGNORECASE)

        # 3. Filetype restrictions (filetype:pdf, ext:docx)
        filetype_matches = re.findall(r'\b(?:filetype|ext):([a-zA-Z0-9]+)', text, re.IGNORECASE)
        operators.filetype_restrictions = [f.lower().strip() for f in filetype_matches]
        text = re.sub(r'\b(?:filetype|ext):[a-zA-Z0-9]+', ' ', text, flags=re.IGNORECASE)

        # 4. Excluded terms (-badterm)
        excluded_matches = re.findall(r'(?:^|\s)-([a-zA-Z0-9_\-]+)', text)
        operators.excluded_terms = [e.lower().strip() for e in excluded_matches]
        text = re.sub(r'(?:^|\s)-[a-zA-Z0-9_\-]+', ' ', text)

        # 5. Time filter operator (time:day / time:week / time:month / time:year)
        time_match = re.search(r'\btime:(day|week|month|year)\b', text, re.IGNORECASE)
        if time_match:
            operators.time_filter = time_match.group(1).lower()
            text = re.sub(r'\btime:(day|week|month|year)\b', ' ', text, flags=re.IGNORECASE)

        # Normalize remaining clean terms
        clean = " ".join(text.split()).strip()
        operators.clean_query = clean or raw_query.strip()
        return operators

    def check_typos(self, query: str) -> Optional[str]:
        """
        Checks for known typos and returns a 'Did you mean?' suggestion.
        """
        low = query.lower().strip()
        if low in COMMON_TYPOS:
            return COMMON_TYPOS[low]

        words = low.split()
        corrected_words = []
        changed = False

        for w in words:
            if w in COMMON_TYPOS:
                corrected_words.append(COMMON_TYPOS[w])
                changed = True
            else:
                corrected_words.append(w)

        if changed:
            return " ".join(corrected_words)
        return None

    def recognize_entities(self, query: str) -> List[Dict[str, str]]:
        """Identifies key technology, academic, or corporate entities."""
        low = query.lower()
        entities = []
        for key, meta in KNOWN_ENTITIES.items():
            pattern = rf'\b{re.escape(key)}\b'
            if re.search(pattern, low):
                entities.append({
                    "name": meta["name"],
                    "entity_type": meta["type"],
                    "domain": meta["domain"],
                    "matched_token": key,
                })
        return entities

    def classify_intent(
        self,
        clean_query: str,
        operators: ParsedSearchOperators,
        entities: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Determines the primary search intent:
        - navigational: Seeking a specific website or platform
        - technical: Code, programming, documentation, API, bugs
        - news: Current events, latest updates, breaking news
        - academic: Papers, scientific studies, university research
        - informational: General knowledge or how-to
        - transactional: Products, pricing, buy, download
        """
        low = clean_query.lower()
        words = low.split()

        # Check navigational
        if len(words) <= 3:
            for ent in entities:
                if ent["matched_token"] in words or ent["name"].lower() == low:
                    return {
                        "intent": "navigational",
                        "confidence": 0.95,
                        "is_navigational": True,
                        "target_platform": ent["name"],
                    }

        # Check news
        news_keywords = ["news", "latest", "today", "yesterday", "update", "happened", "current", "announcement"]
        if any(k in words for k in news_keywords) or operators.time_filter in ("day", "week"):
            return {
                "intent": "news",
                "confidence": 0.88,
                "is_navigational": False,
                "target_platform": None,
            }

        # Check academic / research
        academic_keywords = ["paper", "research", "arxiv", "thesis", "study", "journal", "experiment", "algorithm", "quantum"]
        if any(k in words for k in academic_keywords) or any(f in ("pdf", "ps") for f in operators.filetype_restrictions):
            return {
                "intent": "academic",
                "confidence": 0.85,
                "is_navigational": False,
                "target_platform": None,
            }

        # Check technical / programming
        tech_keywords = ["def", "function", "class", "syntax", "error", "exception", "api", "sdk", "install", "documentation", "docs", "guide", "tutorial", "code", "implementation", "compiler", "runtime"]
        if any(k in words for k in tech_keywords) or any(w in ["python", "javascript", "typescript", "c++", "rust", "react", "docker"] for w in words):
            return {
                "intent": "technical",
                "confidence": 0.90,
                "is_navigational": False,
                "target_platform": None,
            }

        # Check transactional
        trans_keywords = ["buy", "price", "pricing", "download", "subscription", "order", "purchase"]
        if any(k in words for k in trans_keywords):
            return {
                "intent": "transactional",
                "confidence": 0.80,
                "is_navigational": False,
                "target_platform": None,
            }

        # Default: Informational
        return {
            "intent": "informational",
            "confidence": 0.75,
            "is_navigational": False,
            "target_platform": None,
        }

    def analyze(self, raw_query: str) -> QueryUnderstandingResult:
        """
        Executes end-to-end query understanding pipeline.
        """
        raw = raw_query.strip()
        operators = self.parse_operators(raw)
        correction = self.check_typos(operators.clean_query)
        entities = self.recognize_entities(operators.clean_query)
        intent_info = self.classify_intent(operators.clean_query, operators, entities)

        return QueryUnderstandingResult(
            raw_query=raw,
            clean_query=operators.clean_query,
            intent=intent_info["intent"],
            confidence=intent_info["confidence"],
            operators=operators,
            suggested_correction=correction,
            has_typo=bool(correction and correction.lower() != operators.clean_query.lower()),
            recognized_entities=entities,
            is_navigational=intent_info["is_navigational"],
            target_platform=intent_info["target_platform"],
        )


# Global singleton
query_understanding_engine = QueryUnderstandingEngine()
