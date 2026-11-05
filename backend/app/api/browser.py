"""
ANVESHA Intelligent Browser REST API Router.
Handles tab management, omnibox navigation, distraction-free reader mode,
bookmarks, history, and one-click privacy cleanup.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import PlatformDB
from engine.browser_service import browser_service
from engine.tor_service import tor_service, TorFailClosedError
from engine.security_service import security_service

router = APIRouter(prefix="/browser", tags=["Intelligent Browser"])


# --- Request Models ---

class NavigateRequest(BaseModel):
    input: str = Field(..., min_length=1, description="URL or search query entered into Omnibox")
    tab_mode: Optional[str] = Field("normal", description="'normal', 'incognito', or 'tor'")


class TabSaveRequest(BaseModel):
    tab_id: str
    url: str
    title: str
    mode: Optional[str] = "normal"
    session_id: Optional[str] = "default"
    is_pinned: Optional[bool] = False
    is_reader_mode: Optional[bool] = False
    is_desktop_site: Optional[bool] = False
    position: Optional[int] = 0


class BookmarkCreateRequest(BaseModel):
    url: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    domain: Optional[str] = None
    snippet: Optional[str] = ""
    folder: Optional[str] = "General"
    favicon: Optional[str] = None


class PrivacyCleanupRequest(BaseModel):
    clear_browser_history: Optional[bool] = True
    clear_bookmarks: Optional[bool] = False
    clear_browser_tabs: Optional[bool] = True
    clear_search_history: Optional[bool] = False
    clear_cache: Optional[bool] = True


# --- Endpoints ---

@router.post("/navigate")
def navigate_omnibox(payload: NavigateRequest):
    """
    Smart Omnibox resolver:
    - Automatically cleans tracking parameters (ClearURLs)
    - Performs HTTPS upgrade check
    - Enforces Tor Fail-Closed policy on onion URLs or Tor tabs
    """
    resolved = browser_service.resolve_url_or_search(payload.input)
    target_url = resolved["url"]
    is_tor_tab = (payload.tab_mode == "tor") or resolved["is_onion"]

    # Tor Fail-Closed Enforcement
    if is_tor_tab or resolved["is_onion"]:
        try:
            tor_service.assert_tor_routing_allowed(target_url, is_tor_tab=True)
        except TorFailClosedError as e:
            raise HTTPException(status_code=503, detail=str(e))

    # Security & Tracker Inspection
    sec_check = security_service.check_url_security(target_url)
    if sec_check["is_tracker"]:
        security_service.record_tracker_block(resolved.get("domain", target_url))

    # Record to persistent history if NOT private/incognito
    if payload.tab_mode != "incognito" and payload.tab_mode != "tor" and resolved["type"] != "empty":
        PlatformDB.add_browser_history(
            url=sec_check["upgraded_url"],
            title=resolved.get("domain", sec_check["upgraded_url"]),
            domain=resolved.get("domain", ""),
            is_private=False
        )

    return {
        "resolved": resolved,
        "security": sec_check,
        "tab_mode": payload.tab_mode,
    }


@router.get("/reader")
async def get_reader_content(url: str = Query(..., description="Target webpage URL")):
    """Extracts clean distraction-free reader mode content."""
    res = await browser_service.extract_reader_mode(url)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Reader mode extraction failed"))
    return res


# --- Tabs API ---

@router.get("/tabs")
def list_tabs(session_id: str = "default"):
    """Returns active tabs for the specified session."""
    return {"tabs": PlatformDB.list_browser_tabs(session_id)}


@router.post("/tabs")
def save_tab(payload: TabSaveRequest):
    """Saves or updates a browser tab state."""
    tab = PlatformDB.save_browser_tab(
        tab_id=payload.tab_id,
        url=payload.url,
        title=payload.title,
        mode=payload.mode or "normal",
        session_id=payload.session_id or "default",
        is_pinned=payload.is_pinned or False,
        is_reader_mode=payload.is_reader_mode or False,
        is_desktop_site=payload.is_desktop_site or False,
        position=payload.position or 0
    )
    return {"tab": tab}


@router.delete("/tabs/{tab_id}")
def close_tab(tab_id: str):
    """Closes a specific tab."""
    success = PlatformDB.close_browser_tab(tab_id)
    return {"closed": success, "tab_id": tab_id}


# --- Bookmarks API ---

@router.get("/bookmarks")
def list_bookmarks(folder: Optional[str] = None, q: Optional[str] = None):
    """Returns saved bookmarks with optional folder or search filtering."""
    bookmarks = PlatformDB.list_browser_bookmarks(folder=folder, query=q)
    folders = PlatformDB.list_bookmark_folders()
    return {"bookmarks": bookmarks, "folders": folders, "total": len(bookmarks)}


@router.post("/bookmarks")
def add_bookmark(payload: BookmarkCreateRequest):
    """Creates or updates a browser bookmark."""
    domain = payload.domain or browser_service.extract_domain(payload.url)
    bm = PlatformDB.add_browser_bookmark(
        url=payload.url,
        title=payload.title,
        domain=domain,
        snippet=payload.snippet or "",
        folder=payload.folder or "General",
        favicon=payload.favicon
    )
    return {"message": "Bookmark saved successfully", "bookmark": bm}


@router.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: str):
    """Removes a bookmark."""
    success = PlatformDB.delete_browser_bookmark(bookmark_id)
    return {"deleted": success, "bookmark_id": bookmark_id}


# --- History API ---

@router.get("/history")
def list_history(q: Optional[str] = None, limit: int = 100, offset: int = 0):
    """Returns browser history excluding private/incognito visits."""
    history = PlatformDB.list_browser_history(query=q, limit=limit, offset=offset)
    return {"history": history, "total": len(history)}


@router.delete("/history/{item_id}")
def delete_history_item(item_id: str):
    """Deletes an individual history entry."""
    success = PlatformDB.delete_browser_history_item(item_id)
    return {"deleted": success, "item_id": item_id}


@router.delete("/history")
def clear_history():
    """Clears all browser history."""
    count = PlatformDB.clear_browser_history()
    return {"message": f"Cleared {count} history entries", "count": count}


# --- One-Click Privacy Cleanup API ---

@router.post("/cleanup")
def execute_privacy_cleanup(payload: PrivacyCleanupRequest):
    """Executes atomic privacy sanitization across selected data layers."""
    results = PlatformDB.execute_privacy_cleanup(
        clear_browser_history=payload.clear_browser_history or False,
        clear_bookmarks=payload.clear_bookmarks or False,
        clear_browser_tabs=payload.clear_browser_tabs or False,
        clear_search_history=payload.clear_search_history or False,
        clear_cache=payload.clear_cache or False
    )
    return {
        "message": "Privacy cleanup completed successfully",
        "deleted": results
    }
