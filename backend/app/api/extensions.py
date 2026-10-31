"""
Anvesha Extensions Platform REST API.

Provides endpoints for:
- Registry discovery and manifest inspection
- Installation, uninstallation, enabling, disabling, and visibility toggling
- Sandboxed isolated storage read/write
- SSRF-safe network proxy for extensions with 'network:fetch' permission
- Security audit log inspection
"""
import httpx
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.extensions_engine import (
    ExtensionEngine,
    ExtensionValidationError,
    ExtensionPermissionError,
)
from app.core.db import PlatformDB

router = APIRouter(prefix="/extensions", tags=["extensions"])


class RegisterExtensionRequest(BaseModel):
    manifest: Dict[str, Any] = Field(..., description="Extension manifest object adhering to Anvesha Extension SDK spec")


class StorageSetRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=128)
    value: Any = Field(..., description="JSON-serializable data")


class VisibilityRequest(BaseModel):
    visible: bool = Field(...)


class ProxyFetchRequest(BaseModel):
    url: str = Field(..., description="Target HTTP/HTTPS URL")
    method: str = Field(default="GET", description="HTTP method (GET, POST)")
    headers: Optional[Dict[str, str]] = Field(default=None)
    body: Optional[Any] = Field(default=None)


@router.get("")
def list_extensions():
    """Returns all registered extensions and their current states."""
    try:
        return {"extensions": ExtensionEngine.list_extensions()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{extension_id}")
def get_extension(extension_id: str):
    """Retrieves a single extension by ID."""
    ext = ExtensionEngine.get_extension(extension_id)
    if not ext:
        raise HTTPException(status_code=404, detail=f"Extension '{extension_id}' not found")
    return {"extension": ext}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_extension(payload: RegisterExtensionRequest):
    """
    Registers a new extension manifest.
    Default state: installed = false, enabled = false, visible = false.
    """
    try:
        ext = ExtensionEngine.register_extension(payload.manifest)
        return {
            "message": f"Extension '{ext['id']}' registered successfully",
            "extension": ext,
        }
    except ExtensionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{extension_id}/install")
def install_extension(extension_id: str):
    """Installs an extension. Leaves it disabled until explicitly enabled."""
    try:
        ext = ExtensionEngine.install_extension(extension_id)
        return {
            "message": f"Extension '{extension_id}' installed successfully",
            "extension": ext,
        }
    except ExtensionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{extension_id}/uninstall")
def uninstall_extension(extension_id: str):
    """Uninstalls an extension, automatically disabling it."""
    try:
        ext = ExtensionEngine.uninstall_extension(extension_id)
        return {
            "message": f"Extension '{extension_id}' uninstalled successfully",
            "extension": ext,
        }
    except ExtensionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{extension_id}/enable")
def enable_extension(extension_id: str):
    """Enables an installed extension so its code and side panel can be used."""
    try:
        ext = ExtensionEngine.enable_extension(extension_id)
        return {
            "message": f"Extension '{extension_id}' enabled successfully",
            "extension": ext,
        }
    except ExtensionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{extension_id}/disable")
def disable_extension(extension_id: str):
    """Disables an extension immediately halting any actions."""
    try:
        ext = ExtensionEngine.disable_extension(extension_id)
        return {
            "message": f"Extension '{extension_id}' disabled successfully",
            "extension": ext,
        }
    except ExtensionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{extension_id}/visibility")
def set_extension_visibility(extension_id: str, payload: VisibilityRequest):
    """Toggles visibility in the side panel drawer."""
    try:
        ext = ExtensionEngine.set_visibility(extension_id, payload.visible)
        return {
            "message": f"Extension '{extension_id}' visibility updated to {payload.visible}",
            "extension": ext,
        }
    except ExtensionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{extension_id}")
def delete_extension(extension_id: str):
    """Removes an extension from the registry completely."""
    ext = ExtensionEngine.get_extension(extension_id)
    if not ext:
        raise HTTPException(status_code=404, detail=f"Extension '{extension_id}' not found")

    PlatformDB.delete_extension(extension_id)
    PlatformDB.log_extension_audit(
        extension_id=extension_id,
        action="DELETE_REGISTRATION",
        details={},
    )
    return {"message": f"Extension '{extension_id}' removed from registry"}


# --- Isolated Extension Storage Endpoints ---

@router.get("/{extension_id}/storage")
def get_extension_storage(extension_id: str, key: Optional[str] = Query(None)):
    """
    Reads isolated storage for an enabled extension.
    Requires declared 'storage:read' permission.
    """
    try:
        if key:
            val = ExtensionEngine.get_storage(extension_id, key)
            return {"key": key, "value": val}
        data = ExtensionEngine.list_storage(extension_id)
        return {"storage": data}
    except ExtensionValidationError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ExtensionPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{extension_id}/storage")
def set_extension_storage(extension_id: str, payload: StorageSetRequest):
    """
    Writes isolated storage for an enabled extension.
    Requires declared 'storage:write' permission.
    """
    try:
        ExtensionEngine.set_storage(extension_id, payload.key, payload.value)
        return {"message": "Storage value saved", "key": payload.key}
    except ExtensionValidationError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ExtensionPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{extension_id}/storage/{key}")
def delete_extension_storage(extension_id: str, key: str):
    """
    Deletes a key from isolated storage.
    Requires declared 'storage:write' permission.
    """
    try:
        ExtensionEngine.delete_storage(extension_id, key)
        return {"message": f"Storage key '{key}' deleted"}
    except ExtensionValidationError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ExtensionPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- SSRF-Safe Network Proxy Endpoint ---

@router.post("/{extension_id}/proxy")
async def proxy_extension_fetch(extension_id: str, req: ProxyFetchRequest):
    """
    Executes an outbound HTTP request on behalf of an extension.
    Verifies that the extension is enabled, has 'network:fetch' permission,
    and target URL is safe from SSRF attacks (no localhost, loopback, or private RFC1918 IPs).
    """
    is_safe, error_msg = ExtensionEngine.validate_network_target(extension_id, req.url)
    if not is_safe:
        raise HTTPException(status_code=403, detail=f"Network fetch blocked: {error_msg}")

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            headers = req.headers or {}
            headers["User-Agent"] = f"Anvesha-Extension/{extension_id}"
            
            method = req.method.upper()
            if method == "POST":
                resp = await client.post(req.url, headers=headers, json=req.body)
            else:
                resp = await client.get(req.url, headers=headers)

            PlatformDB.log_extension_audit(
                extension_id=extension_id,
                action="NETWORK_FETCH",
                details={"url": req.url, "status_code": resp.status_code},
            )

            try:
                data = resp.json()
            except Exception:
                data = resp.text

            return {
                "status_code": resp.status_code,
                "data": data,
                "headers": dict(resp.headers),
            }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Outbound request failed: {str(e)}")


# --- Audit Logs Endpoint ---

@router.get("/{extension_id}/audit")
def get_extension_audit_logs(extension_id: str, limit: int = Query(50, ge=1, le=200)):
    """Retrieves security and lifecycle audit logs for an extension."""
    ext = ExtensionEngine.get_extension(extension_id)
    if not ext:
        raise HTTPException(status_code=404, detail=f"Extension '{extension_id}' not found")
    logs = PlatformDB.get_extension_audit_logs(extension_id=extension_id, limit=limit)
    return {"extension_id": extension_id, "logs": logs}
