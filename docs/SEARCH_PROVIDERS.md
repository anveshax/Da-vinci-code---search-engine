# ANVESHA Search Providers & Specialized Adapters Reference

This document provides transparent, exhaustive documentation for all search providers and specialized information adapters integrated into the ANVESHA search platform.

---

## 1. Web Search Engine Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | DuckDuckGo HTML (Default), Tavily, Brave Search, Exa |
| **Required Credentials** | None for DuckDuckGo. Optional: `TAVILY_API_KEY`, `BRAVE_API_KEY`, `EXA_API_KEY` |
| **Cost & Usage** | DuckDuckGo: Zero cost. Tavily/Brave: Free monthly tiers |
| **Rate Limits** | DuckDuckGo: Throttled upon burst automated requests; Tavily: 1,000 queries/month free |
| **Attribution** | Direct links to original destination web pages, domain favicons, and verified titles |
| **Fallback Behavior** | If external HTTP connection fails (e.g. sandbox or offline), the system flags the issue transparently and uses grounded contextual synthesis. Never invents fake URLs or hallucinated citations. |

---

## 2. Entity Knowledge Graph Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | Wikipedia REST API & Curated Verified Knowledge Corpus |
| **Required Credentials** | None (Public REST endpoints) |
| **Cost & Usage** | Free and open access |
| **Rate Limits** | Standard Wikimedia guidelines (~200 requests/second with descriptive User-Agent) |
| **Attribution** | Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0), Wikipedia Contributors |
| **Fallback Behavior** | When offline or sandboxed, utilizes the verified factual knowledge corpus for recognized entities (Cities, Languages, Software, Science). Returns `is_live: false` with explicit fallback disclosure. |

---

## 3. Weather Forecast Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | Open-Meteo Weather Forecast API (`api.open-meteo.com`) |
| **Required Credentials** | None (No API key needed) |
| **Cost & Usage** | 100% Free for non-commercial and educational use |
| **Rate Limits** | Up to 10,000 API requests per day |
| **Attribution** | "Weather data by Open-Meteo.com (CC BY 4.0)" |
| **Fallback Behavior** | If the location query is unknown or the network is isolated, reports the offline status clearly or shows an unavailable state. Never simulates fake or invented temperatures. |

---

## 4. Maps & Geographic Navigation Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | OpenStreetMap (OSM) Embed & Tile Server |
| **Required Credentials** | None |
| **Cost & Usage** | 100% Free and open-source |
| **Rate Limits** | Standard OSM Tile Usage Policy (fair usage, no bulk scraping) |
| **Attribution** | "© OpenStreetMap contributors (Open Database License ODbL 1.0)" |
| **Fallback Behavior** | Only rendered when the query contains an identified geographic location (e.g., Delhi, London). For non-geographic queries, the map panel is completely omitted. |

---

## 5. Directions & Routing Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | OSRM (Open Source Routing Machine) via OpenStreetMap |
| **Required Credentials** | None |
| **Cost & Usage** | Free public routing engine |
| **Rate Limits** | Fair use for routing requests |
| **Attribution** | OSRM & OpenStreetMap contributors |
| **Fallback Behavior** | Directs the user to an interactive OpenStreetMap directions URL with the destination pre-populated. |

---

## 6. News Search Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | Curated Verified Tech RSS / DuckDuckGo News |
| **Required Credentials** | None |
| **Cost & Usage** | Free |
| **Rate Limits** | Standard HTTP scraping limits |
| **Attribution** | Source publisher domain, publication timestamp, and original article link |
| **Fallback Behavior** | If no relevant news is retrieved for a query, the news tab and panel display a clear message: `"News feed provider not configured for this specific query."` |

---

## 7. Images Search Provider

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | Wikimedia Commons Open Media |
| **Required Credentials** | None |
| **Cost & Usage** | Free & Open Access |
| **Rate Limits** | Standard Wikimedia Commons fair use |
| **Attribution** | Wikimedia Commons and original creators under CC licenses |
| **Fallback Behavior** | Shows verified images for entities with open assets. If no verified media exists, the image tab displays an honest empty state without broken images. |

---

## 8. Video Search Provider (Unconfigured)

| Attribute | Specification |
| :--- | :--- |
| **Provider Names** | YouTube Data API v3 (Optional) |
| **Required Credentials** | `YOUTUBE_API_KEY` (Not configured by default) |
| **Cost & Usage** | 10,000 units/day free tier |
| **Rate Limits** | Governed by Google Cloud project quota |
| **Attribution** | YouTube LLC / Alphabet |
| **Fallback Behavior** | Honestly reports as unconfigured: `"Video search provider not configured — configure YOUTUBE_API_KEY in Platform Settings."` |
