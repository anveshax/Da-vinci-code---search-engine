"""
Anvesha Extension System Core Engine.

Provides:
- Manifest schema validation and semantic version compatibility
- Permission validation and network security (SSRF prevention)
- Extension lifecycle management (register, install, uninstall, enable, disable)
- Health status monitoring and isolated storage operations
- Audit logging for all extension lifecycle events and permissions
"""
import re
import ipaddress
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
from app.core.db import PlatformDB

SUPPORTED_SDK_VERSION = "1.0.0"

VALID_PERMISSIONS = {
    "storage:read",
    "storage:write",
    "workspace:read",
    "network:fetch",
    "ui:sidepanel",
    "events:listen",
    "events:emit",
    "audit:log",
}

DISALLOWED_NETWORK_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "metadata.google.internal",
    "169.254.169.254",
}


class ExtensionValidationError(Exception):
    """Raised when an extension manifest or request violates validation rules."""
    pass


class ExtensionPermissionError(Exception):
    """Raised when an extension attempts an action without holding required permissions."""
    pass


class ExtensionEngine:
    """Core runtime engine for Anvesha Extensions."""

    @staticmethod
    def validate_manifest(manifest: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validates manifest schema and compatibility.
        Returns (is_valid, error_message).
        """
        if not isinstance(manifest, dict):
            return False, "Manifest must be a JSON object"

        # Check required fields
        required_fields = ["id", "name", "version", "sdkVersion", "description"]
        for field in required_fields:
            if field not in manifest or not manifest[field]:
                return False, f"Manifest missing required field: '{field}'"

        ext_id = str(manifest["id"])
        if not re.match(r"^[a-z0-9-_.]+$", ext_id):
            return False, f"Extension ID '{ext_id}' is invalid. Use lowercase letters, numbers, hyphens, underscores, or dots."

        # Validate semver
        version = str(manifest["version"])
        if not re.match(r"^\d+\.\d+\.\d+", version):
            return False, f"Extension version '{version}' is not valid semantic versioning (e.g. 1.0.0)"

        # Check SDK version compatibility
        sdk_version = str(manifest["sdkVersion"])
        core_major = SUPPORTED_SDK_VERSION.split(".")[0]
        ext_sdk_major = sdk_version.split(".")[0]
        if core_major != ext_sdk_major:
            return False, f"Incompatible SDK version '{sdk_version}'. Core platform supports SDK major version {core_major}.x"

        # Validate permissions
        permissions = manifest.get("permissions", [])
        if not isinstance(permissions, list):
            return False, "Permissions must be a list of strings"

        for perm in permissions:
            if perm not in VALID_PERMISSIONS:
                return False, f"Unknown permission: '{perm}'. Valid permissions are: {sorted(list(VALID_PERMISSIONS))}"

        return True, None

    @staticmethod
    def register_extension(manifest: Dict[str, Any]) -> Dict[str, Any]:
        """
        Registers a new extension in the registry.
        By requirement: newly registered extensions default to:
        installed = False, enabled = False, visible = False.
        """
        is_valid, err = ExtensionEngine.validate_manifest(manifest)
        if not is_valid:
            raise ExtensionValidationError(err)

        ext_id = manifest["id"]
        name = manifest["name"]
        version = manifest["version"]

        ext = PlatformDB.register_extension(
            extension_id=ext_id,
            name=name,
            version=version,
            manifest=manifest,
            installed=False,
            enabled=False,
            visible=False,
        )

        PlatformDB.log_extension_audit(
            extension_id=ext_id,
            action="REGISTER",
            details={"version": version, "permissions": manifest.get("permissions", [])},
        )
        return ext

    @staticmethod
    def list_extensions() -> List[Dict[str, Any]]:
        return PlatformDB.list_extensions()

    @staticmethod
    def get_extension(extension_id: str) -> Optional[Dict[str, Any]]:
        return PlatformDB.get_extension(extension_id)

    @staticmethod
    def install_extension(extension_id: str) -> Dict[str, Any]:
        """Installs an extension. Leaves it disabled by default until explicitly enabled."""
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")

        updated = PlatformDB.update_extension_state(
            extension_id=extension_id,
            installed=True,
            health_status="healthy",
            health_message="Extension installed successfully.",
        )
        PlatformDB.log_extension_audit(
            extension_id=extension_id,
            action="INSTALL",
            details={"installed": True},
        )
        return updated

    @staticmethod
    def uninstall_extension(extension_id: str) -> Dict[str, Any]:
        """Uninstalls an extension. Automatically disables and hides it."""
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")

        updated = PlatformDB.update_extension_state(
            extension_id=extension_id,
            installed=False,
            enabled=False,
            visible=False,
            health_status="disabled",
            health_message="Extension uninstalled.",
        )
        PlatformDB.log_extension_audit(
            extension_id=extension_id,
            action="UNINSTALL",
            details={"installed": False, "enabled": False},
        )
        return updated

    @staticmethod
    def enable_extension(extension_id: str) -> Dict[str, Any]:
        """Enables an installed extension so it can execute."""
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")
        if not ext["installed"]:
            raise ExtensionValidationError(f"Cannot enable extension '{extension_id}' because it is not installed.")

        updated = PlatformDB.update_extension_state(
            extension_id=extension_id,
            enabled=True,
            health_status="healthy",
            health_message="Extension enabled and active.",
        )
        PlatformDB.log_extension_audit(
            extension_id=extension_id,
            action="ENABLE",
            details={"enabled": True},
        )
        return updated

    @staticmethod
    def disable_extension(extension_id: str) -> Dict[str, Any]:
        """Disables an extension immediately halting execution and blocking storage access."""
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")

        updated = PlatformDB.update_extension_state(
            extension_id=extension_id,
            enabled=False,
            visible=False,
            health_status="disabled",
            health_message="Extension deactivated by user/system.",
        )
        PlatformDB.log_extension_audit(
            extension_id=extension_id,
            action="DISABLE",
            details={"enabled": False},
        )
        return updated

    @staticmethod
    def set_visibility(extension_id: str, visible: bool) -> Dict[str, Any]:
        """Toggles the side-panel visibility of an enabled extension."""
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")
        if visible and not ext["enabled"]:
            raise ExtensionValidationError(f"Cannot show extension '{extension_id}' in side panel because it is not enabled.")

        return PlatformDB.update_extension_state(extension_id=extension_id, visible=visible)

    @staticmethod
    def check_permission(ext: Dict[str, Any], required_permission: str) -> None:
        """Verifies that an extension declared a specific permission in its manifest."""
        manifest = ext.get("manifest", {})
        perms = manifest.get("permissions", [])
        if required_permission not in perms:
            raise ExtensionPermissionError(
                f"Extension '{ext.get('id')}' lacks declared permission: '{required_permission}'"
            )

    @staticmethod
    def get_storage(extension_id: str, key: str) -> Any:
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")
        if not ext["enabled"]:
            raise ExtensionPermissionError(f"Extension '{extension_id}' is disabled. Storage access denied.")
        ExtensionEngine.check_permission(ext, "storage:read")
        return PlatformDB.get_extension_storage(extension_id, key)

    @staticmethod
    def list_storage(extension_id: str) -> Dict[str, Any]:
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")
        if not ext["enabled"]:
            raise ExtensionPermissionError(f"Extension '{extension_id}' is disabled. Storage access denied.")
        ExtensionEngine.check_permission(ext, "storage:read")
        return PlatformDB.list_extension_storage(extension_id)

    @staticmethod
    def set_storage(extension_id: str, key: str, value: Any) -> None:
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")
        if not ext["enabled"]:
            raise ExtensionPermissionError(f"Extension '{extension_id}' is disabled. Storage write denied.")
        ExtensionEngine.check_permission(ext, "storage:write")
        PlatformDB.set_extension_storage(extension_id, key, value)
        PlatformDB.log_extension_audit(
            extension_id=extension_id,
            action="STORAGE_SET",
            details={"key": key},
        )

    @staticmethod
    def delete_storage(extension_id: str, key: str) -> bool:
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            raise ExtensionValidationError(f"Extension '{extension_id}' not found.")
        if not ext["enabled"]:
            raise ExtensionPermissionError(f"Extension '{extension_id}' is disabled. Storage write denied.")
        ExtensionEngine.check_permission(ext, "storage:write")
        return PlatformDB.delete_extension_storage(extension_id, key)

    @staticmethod
    def validate_network_target(extension_id: str, target_url: str) -> Tuple[bool, Optional[str]]:
        """
        Validates target URL against SSRF vulnerabilities and ensures permission is declared.
        """
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            return False, f"Extension '{extension_id}' not found"
        if not ext["enabled"]:
            return False, "Extension is disabled"

        # Check permission
        manifest = ext.get("manifest", {})
        perms = manifest.get("permissions", [])
        if "network:fetch" not in perms:
            return False, "Extension does not have 'network:fetch' permission declared"

        parsed = urllib.parse.urlparse(target_url)
        if parsed.scheme not in ("http", "https"):
            return False, f"Invalid URL scheme '{parsed.scheme}'. Only http and https are allowed."

        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return False, "Invalid target URL: missing hostname"

        if hostname in DISALLOWED_NETWORK_HOSTS:
            return False, f"Network access to '{hostname}' is blocked for security (SSRF prevention)"

        # Check for private IP address ranges
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False, f"Network access to private/reserved IP '{hostname}' is blocked"
        except ValueError:
            # Not a raw IP literal, hostname is a domain
            pass

        return True, None
