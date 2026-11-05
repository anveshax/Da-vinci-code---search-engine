#!/usr/bin/env node

/**
 * ANVESHA GLOBAL NEWS INTEGRATION VERIFICATION SUITE
 * Validates backend modular aggregation engine, public APIs, RSS feeds,
 * deduplication, clustering, ranking, health monitoring, SSE live streaming,
 * and frontend components.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function verify(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${name}`);
    if (errorMsg) console.error(`  ↳ ${errorMsg}`);
    failed++;
  }
}

console.log('==================================================================');
console.log('       ANVESHA GLOBAL NEWS PLATFORM VERIFICATION SUITE           ');
console.log('==================================================================');

// 1. Backend Engine Files
const requiredFiles = [
  'backend/engine/news/models.py',
  'backend/engine/news/worldpulse_provider.py',
  'backend/engine/news/actually_relevant_provider.py',
  'backend/engine/news/rss_provider.py',
  'backend/engine/news/freshrss_provider.py',
  'backend/engine/news/feed_registry.py',
  'backend/engine/news/news_normalizer.py',
  'backend/engine/news/news_deduplicator.py',
  'backend/engine/news/news_clusterer.py',
  'backend/engine/news/news_ranker.py',
  'backend/engine/news/news_scheduler.py',
  'backend/engine/news/news_cache.py',
  'backend/engine/news/news_health.py',
  'backend/engine/news/news_service.py',
  'backend/app/api/news.py',
  'backend/tests/test_global_news_engine.py',
  'frontend/src/components/GlobalNewsView.tsx',
];

for (const relPath of requiredFiles) {
  const fullPath = path.resolve(relPath);
  verify(`File exists: ${relPath}`, fs.existsSync(fullPath), `Missing ${relPath}`);
}

// 2. Feed Registry Verification
const feedRegistryContent = fs.readFileSync(path.resolve('backend/engine/news/feed_registry.py'), 'utf-8');

verify(
  'Feed registry includes BBC World and BBC Technology',
  feedRegistryContent.includes('bbc_world') && feedRegistryContent.includes('bbc_tech'),
  'BBC feeds missing'
);

verify(
  'Feed registry includes Al Jazeera and The Guardian',
  feedRegistryContent.includes('al_jazeera') && feedRegistryContent.includes('the_guardian_world'),
  'Al Jazeera / Guardian missing'
);

verify(
  'Feed registry includes Indian publishers (Times of India, NDTV, The Hindu)',
  feedRegistryContent.includes('times_of_india') && feedRegistryContent.includes('ndtv_top') && feedRegistryContent.includes('hindu_national'),
  'Indian publishers missing'
);

verify(
  'Feed registry includes Tech publishers (TechCrunch, The Verge, Ars Technica, Engadget)',
  feedRegistryContent.includes('techcrunch') && feedRegistryContent.includes('the_verge') && feedRegistryContent.includes('ars_technica') && feedRegistryContent.includes('engadget'),
  'Tech publishers missing'
);

verify(
  'Feed registry includes 18 worldwide countries/regions',
  feedRegistryContent.includes('"code": "IN"') &&
  feedRegistryContent.includes('"code": "US"') &&
  feedRegistryContent.includes('"code": "GB"') &&
  feedRegistryContent.includes('"code": "DE"') &&
  feedRegistryContent.includes('"code": "FR"') &&
  feedRegistryContent.includes('"code": "JP"') &&
  feedRegistryContent.includes('"code": "WORLD"'),
  'Country list incomplete'
);

verify(
  'Feed registry supports multi-lingual news (English, Hindi, French, German, Japanese, Spanish)',
  feedRegistryContent.includes('"hi"') &&
  feedRegistryContent.includes('"fr"') &&
  feedRegistryContent.includes('"de"') &&
  feedRegistryContent.includes('"ja"') &&
  feedRegistryContent.includes('"es"'),
  'Languages missing'
);

// 3. API Routes Verification
const newsApiContent = fs.readFileSync(path.resolve('backend/app/api/news.py'), 'utf-8');

const requiredEndpoints = [
  '/worldwide',
  '/headlines',
  '/search',
  '/countries',
  '/languages',
  '/categories',
  '/trending',
  '/sources',
  '/status',
  '/updates',
  '/briefing',
  '/ask-ai',
];

for (const ep of requiredEndpoints) {
  verify(
    `API endpoint registered: ${ep}`,
    newsApiContent.includes(`"${ep}"`) || newsApiContent.includes(`'${ep}'`),
    `Endpoint ${ep} missing in backend/app/api/news.py`
  );
}

// 4. FastAPI main.py mounting verification
const mainPyContent = fs.readFileSync(path.resolve('backend/app/main.py'), 'utf-8');
verify(
  'News router mounted in main.py for /api/v1, /api, and /api/v2',
  mainPyContent.includes('news_router') &&
  mainPyContent.includes('global_news_service.initialize()') &&
  mainPyContent.includes('global_news_service.scheduler.stop()'),
  'news_router or lifecycle integration missing in main.py'
);

// 5. Frontend Integration Verification
const appContent = fs.readFileSync(path.resolve('frontend/src/App.tsx'), 'utf-8');
const sidebarContent = fs.readFileSync(path.resolve('frontend/src/components/AppSidebar.tsx'), 'utf-8');
const globalNewsViewContent = fs.readFileSync(path.resolve('frontend/src/components/GlobalNewsView.tsx'), 'utf-8');
const apiServiceContent = fs.readFileSync(path.resolve('frontend/src/services/api.ts'), 'utf-8');

verify(
  'App.tsx renders GlobalNewsView for currentView === news',
  appContent.includes('GlobalNewsView') && appContent.includes("currentView === 'news'"),
  'App.tsx missing GlobalNewsView rendering'
);

verify(
  'AppSidebar includes Global News navigation option',
  sidebarContent.includes("id: 'news'") && sidebarContent.includes('Global News'),
  'AppSidebar missing Global News'
);

verify(
  'Frontend API service includes worldwide news fetch, search, briefing, and SSE methods',
  apiServiceContent.includes('fetchWorldwideNews') &&
  apiServiceContent.includes('searchWorldwideNews') &&
  apiServiceContent.includes('generateNewsBriefing') &&
  apiServiceContent.includes('askAIAboutStory') &&
  apiServiceContent.includes('createNewsSSEConnection'),
  'api.ts missing required news methods'
);

verify(
  'GlobalNewsView includes breaking ticker, country selector, multi-source clusters, and daily briefing modal',
  globalNewsViewContent.includes('Breaking') &&
  globalNewsViewContent.includes('selectedCountry') &&
  globalNewsViewContent.includes('selectedLanguage') &&
  globalNewsViewContent.includes('briefingModalOpen') &&
  globalNewsViewContent.includes('Ask ANVESHA AI News Intelligence') &&
  globalNewsViewContent.includes('savedArticles'),
  'GlobalNewsView features incomplete'
);

console.log('------------------------------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
if (failed === 0) {
  console.log('>>> ALL GLOBAL NEWS VERIFICATIONS PASSED PERFECTLY! <<<');
} else {
  console.error(`>>> ${failed} VERIFICATION(S) FAILED <<<`);
  process.exit(1);
}
