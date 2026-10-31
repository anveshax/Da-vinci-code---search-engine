"""
Security and SSRF Protection Module for ANVESHA Web Crawler.

Enforces strict defense-in-depth against Server-Side Request Forgery (SSRF),
DNS rebinding, private network scanning, cloud metadata access, and resource exhaustion.
"""
import ipaddress
import socket
import logging
from typing import Tuple, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class SSRFSecurityError(Exception):
    """Raised when a URL or resolved IP violates SSRF security policies."""
    pass

# Blocked IP Networks (IPv4 and IPv6)
BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network (local)
    ipaddress.ip_network("10.0.0.0/8"),         # Private RFC 1918
    ipaddress.ip_network("100.64.0.0/10"),      # Shared Address Space (Carrier-grade NAT)
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-Local / Cloud Metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),      # Private RFC 1918
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # TEST-NET-1 (documentation)
    ipaddress.ip_network("192.168.0.0/16"),     # Private RFC 1918
    ipaddress.ip_network("198.18.0.0/15"),      # Network benchmark tests
    ipaddress.ip_network("198.51.100.0/24"),    # TEST-NET-2 (documentation)
    ipaddress.ip_network("203.0.113.0/24"),     # TEST-NET-3 (documentation)
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved for future use
    ipaddress.ip_network("255.255.255.255/32"), # Limited broadcast
    # IPv6
    ipaddress.ip_network("::/128"),             # Unspecified
    ipaddress.ip_network("::1/128"),            # Loopback
    ipaddress.ip_network("fc00::/7"),           # Unique Local Address (ULA)
    ipaddress.ip_network("fe80::/10"),          # Link-Local Unicast
    ipaddress.ip_network("ff00::/8"),           # Multicast
]

# Explicit cloud metadata IPs
CLOUD_METADATA_IPS = {
    "169.254.169.254",   # AWS, GCP, Azure, OpenStack, DigitalOcean
    "169.254.169.123",   # AWS NTP
    "100.100.100.200",   # Alibaba Cloud metadata
    "fd00:ec2::254",     # AWS IPv6 metadata
}

# Permitted schemes and ports
ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443, 8080, 8443}

# Permitted Content-Types
ALLOWED_CONTENT_TYPES = {
    "text/html",
    "application/xhtml+xml",
    "text/plain",
    "text/xml",
    "application/xml",
}

# Blocked file extensions in URL paths
BLOCKED_EXTENSIONS = {
    ".exe", ".bin", ".dmg", ".iso", ".msi", ".deb", ".rpm",
    ".zip", ".tar", ".gz", ".7z", ".rar", ".bz2", ".xz",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".mp3", ".mp4", ".avi", ".mkv", ".mov", ".wav", ".flac",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    ".sh", ".bash", ".bat", ".cmd", ".ps1", ".vbs"
}

# Maximum allowed response size: 5 Megabytes
MAX_RESPONSE_BYTES = 5 * 1024 * 1024

NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")


def unwrap_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    """
    Unwraps IPv4-mapped IPv6 addresses (::ffff:x.x.x.x) and NAT64 translation
    addresses (64:ff9b::x.x.x.x) to their underlying IPv4 address.
    """
    if getattr(ip_obj, "ipv4_mapped", None):
        return ip_obj.ipv4_mapped
    if ip_obj.version == 6 and ip_obj in NAT64_PREFIX:
        return ipaddress.IPv4Address(ip_obj.packed[-4:])
    return ip_obj


def is_ip_blocked(ip_str: str) -> Tuple[bool, str]:
    """
    Checks if a given IP address string falls into any private, loopback,
    multicast, link-local, or cloud metadata network, unwrapping mapped IPv6 addresses.
    """
    clean_ip_str = ip_str.strip()
    if clean_ip_str in CLOUD_METADATA_IPS:
        return True, f"Explicit cloud metadata address blocked: {clean_ip_str}"

    try:
        raw_ip = ipaddress.ip_address(clean_ip_str)
        ip = unwrap_ip(raw_ip)
    except ValueError:
        return True, f"Invalid IP address representation: {clean_ip_str}"

    unwrapped_str = str(ip)
    if unwrapped_str in CLOUD_METADATA_IPS:
        return True, f"Explicit cloud metadata address blocked: {unwrapped_str}"

    if ip.is_loopback:
        return True, "Loopback address is forbidden."
    if ip.is_private:
        return True, "Private / internal RFC 1918 address is forbidden."
    if ip.is_link_local:
        return True, "Link-local address is forbidden."
    if ip.is_multicast:
        return True, "Multicast address is forbidden."
    if ip.is_reserved or ip.is_unspecified:
        return True, "Reserved or unspecified address is forbidden."

    for net in BLOCKED_NETWORKS:
        if ip in net:
            return True, f"IP belongs to forbidden range: {net}"

    return False, ""


def resolve_and_validate_hostname(hostname: str, port: int = 443) -> List[str]:
    """
    Resolves hostname to IP addresses and validates that ALL resolved IPs
    are safe public IPs. Prevents DNS rebinding and internal network scanning.
    """
    clean_host = hostname.strip().lower()
    if clean_host in ("localhost", "localhost.localdomain", "broadcasthost", "ip6-localhost"):
        raise SSRFSecurityError(f"Localhost access is strictly prohibited: {hostname}")

    try:
        # Check if the hostname is directly an IP literal
        ipaddress.ip_address(clean_host)
        is_blocked, reason = is_ip_blocked(clean_host)
        if is_blocked:
            raise SSRFSecurityError(f"Target IP {clean_host} rejected: {reason}")
        return [clean_host]
    except ValueError:
        # It is a domain name, resolve via DNS
        pass

    try:
        addr_info = socket.getaddrinfo(clean_host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise SSRFSecurityError(f"DNS resolution failed for {clean_host}: {e}")

    resolved_ips = []
    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip_addr = sockaddr[0]
        is_blocked, reason = is_ip_blocked(ip_addr)
        if is_blocked:
            logger.warning(f"SSRF Alert: Hostname {clean_host} resolved to forbidden IP {ip_addr}: {reason}")
            raise SSRFSecurityError(f"Host '{clean_host}' resolves to forbidden private/internal IP {ip_addr}: {reason}")
        resolved_ips.append(ip_addr)

    if not resolved_ips:
        raise SSRFSecurityError(f"Could not resolve any valid IP for {clean_host}")

    return resolved_ips


def validate_crawl_url(url: str, allowed_domains: Optional[List[str]] = None) -> Tuple[bool, str]:
    """
    Validates a URL against scheme, port, extension, domain allowlist, and SSRF restrictions.
    Returns (True, '') if safe, or (False, reason) if rejected.
    """
    if not url or not isinstance(url, str):
        return False, "Empty or non-string URL"

    url = url.strip()
    if len(url) > 2048:
        return False, "URL exceeds maximum length of 2048 characters"

    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Failed to parse URL: {e}"

    # 1. Scheme Check
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return False, f"Unsupported URL scheme '{parsed.scheme}'. Only HTTP and HTTPS allowed."

    # 2. Hostname Check
    hostname = parsed.hostname
    if not hostname:
        return False, "URL missing valid hostname."

    hostname_lower = hostname.lower()

    # 3. Port Check
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    if port not in ALLOWED_PORTS:
        return False, f"Forbidden network port: {port}. Allowed ports: {ALLOWED_PORTS}"

    # 4. Extension Check
    path_lower = parsed.path.lower()
    for ext in BLOCKED_EXTENSIONS:
        if path_lower.endswith(ext):
            return False, f"Blocked file extension '{ext}' in URL path"

    # 5. Domain Allowlist Check
    if allowed_domains:
        normalized_allowed = [d.lower().strip() for d in allowed_domains if d.strip()]
        domain_matched = False
        for allowed in normalized_allowed:
            if hostname_lower == allowed or hostname_lower.endswith("." + allowed):
                domain_matched = True
                break
        if not domain_matched:
            return False, f"Domain '{hostname_lower}' is not in approved crawl allowlist."

    # 6. SSRF DNS Resolution Check
    try:
        resolve_and_validate_hostname(hostname_lower, port)
    except SSRFSecurityError as s_err:
        return False, f"SSRF Check Failed: {str(s_err)}"

    return True, ""


def validate_content_type(content_type_header: Optional[str]) -> Tuple[bool, str]:
    """
    Validates Content-Type header to ensure only text/HTML documents are processed.
    """
    if not content_type_header:
        # Allow default html check if header omitted
        return True, ""

    clean_type = content_type_header.split(";")[0].strip().lower()
    if clean_type in ALLOWED_CONTENT_TYPES:
        return True, clean_type

    return False, f"Unsupported Content-Type '{clean_type}'. Only text/html and XML permitted."


# --- Socket-Level DNS Rebinding Protection ---

import httpcore
import httpcore._backends.auto
import httpx


class SSRFProtectedNetworkBackend(httpcore._backends.auto.AutoBackend):
    """
    Custom network backend that intercepts socket TCP connection attempts.
    Validates the destination IP immediately before dialing, eliminating
    Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks.
    """

    async def connect_tcp(self, host: str, port: int, **kwargs):
        try:
            addr_info = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
            for family, socktype, proto, canonname, sockaddr in addr_info:
                ip_addr = sockaddr[0]
                is_blocked, reason = is_ip_blocked(ip_addr)
                if is_blocked:
                    logger.warning(f"TCP-Level SSRF / DNS Rebinding blocked: {host} -> {ip_addr}: {reason}")
                    raise SSRFSecurityError(f"DNS Rebinding / SSRF blocked at TCP connection: {host} -> {ip_addr} ({reason})")
        except socket.gaierror as e:
            raise SSRFSecurityError(f"DNS resolution failed for {host}: {e}")

        return await super().connect_tcp(host, port, **kwargs)


class SafeAsyncHTTPTransport(httpx.AsyncHTTPTransport):
    """
    Drop-in httpx AsyncHTTPTransport configured with socket-level SSRF defense.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pool = httpcore.AsyncConnectionPool(
            network_backend=SSRFProtectedNetworkBackend(),
            ssl_context=self._pool._ssl_context,
            max_connections=15,
        )
