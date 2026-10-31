# SearXNG Deployment & Integration Guide for ANVESHA

## 1. Architecture & Licensing Compliance

SearXNG is an independent metasearch engine licensed under **GNU AGPL-3.0**. 

To maintain strict compliance with AGPL-3.0 and preserve modularity:
- **SearXNG is run as an isolated containerized service** communicating strictly over HTTP JSON.
- **ANVESHA communicates via network requests** to `http://localhost:8080/search?q=...&format=json`.
- ANVESHA does not copy or statically link SearXNG code into its backend codebase.
- In the event that SearXNG is offline or not deployed, ANVESHA's **Tier-2 Python Cascade** automatically handles retrieval so that searches succeed with zero downtime.

---

## 2. Docker Compose Deployment

The repository includes a ready-to-run `docker-compose.searxng.yml` file:

```yaml
version: '3.8'

services:
  searxng:
    image: docker.io/searxng/searxng:latest
    container_name: anvesha-searxng
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://localhost:8080/
      - UWSGI_WORKERS=4
      - UWSGI_THREADS=4
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 2.1 Starting the SearXNG Service
If Docker is installed on your host system:
```bash
docker compose -f docker-compose.searxng.yml up -d
```

### 2.2 Verifying Connectivity
Test that SearXNG returns JSON results:
```bash
curl -s "http://localhost:8080/search?q=test&format=json" | grep -o '"number_of_results":'
```

---

## 3. Configuration (`searxng/settings.yml`)

The configuration file enables JSON output format and disables rate limits for local requests:

```yaml
use_default_settings: true

general:
  debug: false
  instance_name: "ANVESHA Search Gateway"

search:
  safe_search: 0
  autocomplete: ""
  default_lang: "en"
  formats:
    - html
    - json

server:
  port: 8080
  bind_address: "0.0.0.0"
  secret_key: "anvesha_searxng_internal_secret_change_in_prod"
  limiter: false
  image_proxy: false

ui:
  static_use_hash: true
  default_locale: "en"
  theme_args:
    simple_style: "dark"
```

---

## 4. ANVESHA Backend Configuration

In `.env`, configure the SearXNG endpoint:
```env
SEARXNG_URL=http://localhost:8080
```

When ANVESHA starts, [`SearXNGClient`](file:///home/amit/codebasec%20intelligemce%20engine/backend/engine/searxng_client.py) checks connectivity via `GET /api/v2/search/health`. If SearXNG is unreachable, it logs a warning and automatically activates the direct fallback cascade without failing user searches.
