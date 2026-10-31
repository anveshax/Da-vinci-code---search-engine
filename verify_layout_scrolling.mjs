// Layout and Scrolling Architecture Verification Script
import fs from 'fs';
import path from 'path';

const appPath = path.resolve('frontend/src/App.tsx');
const searchViewPath = path.resolve('frontend/src/components/SearchResultsView.tsx');

const appContent = fs.readFileSync(appPath, 'utf8');
const searchViewContent = fs.readFileSync(searchViewPath, 'utf8');

console.log("=== ANVESHA SEARCH DASHBOARD SCROLLING & LAYOUT VERIFICATION ===");

let passed = 0;
let total = 0;

function check(title, condition, detail) {
  total++;
  if (condition) {
    passed++;
    console.log(`PASS [${passed}/${total}]: ${title}`);
  } else {
    console.error(`FAIL: ${title} -> ${detail}`);
  }
}

// Check 1: App.tsx main container has min-h-0
check(
  "App.tsx <main> has flexbox min-h-0 to allow child scroll calculation",
  appContent.includes('min-h-0') && appContent.includes('flex-1'),
  "App.tsx <main> missing min-h-0"
);

// Check 2: SearchResultsView has dedicated scroll container
check(
  "SearchResultsView has flex-1 h-full overflow-y-auto root container",
  searchViewContent.includes('flex-1 w-full h-full overflow-y-auto overflow-x-hidden'),
  "SearchResultsView root container missing overflow-y-auto or full height"
);

// Check 3: Sticky Combined Header Wrapper
check(
  "Sticky combined header & navigation container at top-0 z-30",
  searchViewContent.includes('sticky top-0 z-30 bg-[#070B14]/95'),
  "SearchResultsView missing sticky top-0 wrapper"
);

// Check 4: No fragile top-[61px] hardcoded offset
check(
  "Fragile hardcoded top-[61px] removed to prevent mobile header overlap",
  !searchViewContent.includes('top-[61px]'),
  "Fragile top-[61px] still present in SearchResultsView"
);

// Check 5: Bottom padding pb-24 on main scrollable content
check(
  "Main content has pb-24 bottom breathing room for pagination",
  searchViewContent.includes('pb-24'),
  "SearchResultsView missing pb-24 bottom padding"
);

// Check 6: Responsive Grid layout for two-column dashboard
check(
  "Two-column layout adapts to lg:grid lg:grid-cols-12 on desktop & single-column on mobile",
  searchViewContent.includes('lg:grid lg:grid-cols-12 lg:gap-8 items-start'),
  "Two-column grid layout missing"
);

console.log("--------------------------------------------------------------------------------");
console.log(`RESULT: ${passed}/${total} Layout & Scrolling checks passed successfully!`);
if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
