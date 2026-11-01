// scripts/verify-sidebar-drawer.mjs
import fs from 'fs';
import path from 'path';

console.log("==================================================================");
console.log("   ANVESHA MINIMAL GOOGLE-STYLE SIDEBAR & DRAWER VERIFICATION    ");
console.log("==================================================================");

const appHeaderPath = path.resolve('frontend/src/components/AppHeader.tsx');
const appSidebarPath = path.resolve('frontend/src/components/AppSidebar.tsx');
const appPath = path.resolve('frontend/src/App.tsx');
const searchHomepagePath = path.resolve('frontend/src/components/SearchHomepage.tsx');

const appHeaderContent = fs.readFileSync(appHeaderPath, 'utf8');
const appSidebarContent = fs.readFileSync(appSidebarPath, 'utf8');
const appContent = fs.readFileSync(appPath, 'utf8');
const searchHomepageContent = fs.readFileSync(searchHomepagePath, 'utf8');

let passed = 0;
let failed = 0;

function verify(name, condition, errorMsg = '') {
  if (condition) {
    passed++;
    console.log(`✓ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`✗ [FAIL] ${name} -> ${errorMsg}`);
  }
}

// 1. Remove permanently expanded left sidebar
verify(
  "No permanent desktop sidebar taking up fixed layout width",
  !appSidebarContent.includes('<div className="hidden md:block h-full shrink-0">') &&
  appSidebarContent.includes('if (!isOpen) return null;'),
  "Permanent desktop sidebar still present"
);

// 2. Compact hamburger menu in top-left navigation area
verify(
  "Hamburger menu icon visible on all screen sizes in top-left header",
  appHeaderContent.includes('title="Main menu"') &&
  appHeaderContent.includes('<Menu className="w-5 h-5" />') &&
  !appHeaderContent.includes('className="md:hidden p-2 rounded-xl text-[#9aa0a6]'),
  "Hamburger menu icon missing or restricted by md:hidden"
);

// 3. Collapsible navigation drawer overlay
verify(
  "Drawer implemented as a fixed overlay with dark backdrop blur",
  appSidebarContent.includes('fixed inset-0 z-50 bg-black/70 backdrop-blur-sm') &&
  appSidebarContent.includes('animate-in slide-in-from-left'),
  "Collapsible drawer overlay missing or misconfigured"
);

// 4. Close via backdrop click, close icon, or Escape key
verify(
  "Drawer can be closed by clicking outside backdrop",
  appSidebarContent.includes('onClick={handleClose}') &&
  appSidebarContent.includes('e.stopPropagation()'),
  "Backdrop click to close missing"
);

verify(
  "Drawer includes dedicated close icon button (X)",
  appSidebarContent.includes('<X className="w-5 h-5" />') &&
  appSidebarContent.includes('aria-label="Close menu"'),
  "Close icon button missing"
);

verify(
  "Escape key listener registered to close drawer",
  appSidebarContent.includes("e.key === 'Escape'") &&
  appSidebarContent.includes("addEventListener('keydown'"),
  "Escape key listener missing"
);

// 5. All 9 required navigation options inside the drawer
verify(
  "Drawer contains 'New AI Search' action button",
  appSidebarContent.includes('New AI Search') &&
  appSidebarContent.includes('<Plus className="w-4 h-4 shrink-0" />'),
  "New AI Search button missing"
);

verify(
  "Drawer contains 'AI Search' navigation item",
  appSidebarContent.includes("id: 'search', label: 'AI Search'"),
  "AI Search nav item missing"
);

verify(
  "Drawer contains 'History' navigation item",
  appSidebarContent.includes("id: 'history', label: 'History'"),
  "History nav item missing"
);

verify(
  "Drawer contains 'Web Intelligence' navigation item",
  appSidebarContent.includes("id: 'web_intelligence', label: 'Web Intelligence'"),
  "Web Intelligence nav item missing"
);

verify(
  "Drawer contains 'Web Studio' navigation item",
  appSidebarContent.includes("id: 'web_studio', label: 'Web Studio'"),
  "Web Studio nav item missing"
);

verify(
  "Drawer contains 'Codebase Intelligence' navigation item",
  appSidebarContent.includes("id: 'explorer', label: 'Codebase Intelligence'"),
  "Codebase Intelligence nav item missing"
);

verify(
  "Drawer contains 'Projects' navigation item",
  appSidebarContent.includes("id: 'projects', label: 'Projects'"),
  "Projects nav item missing"
);

verify(
  "Drawer contains 'Extensions' navigation item",
  appSidebarContent.includes("id: 'extensions', label: 'Extensions'"),
  "Extensions nav item missing"
);

verify(
  "Drawer contains 'Settings' navigation item & footer action",
  appSidebarContent.includes("id: 'settings', label: 'Settings'") &&
  appSidebarContent.includes("Settings (Preferences & Lighting)"),
  "Settings item missing"
);

// 6. Preservation of core features
verify(
  "Homepage layout, branding, and 3D globe remain preserved",
  searchHomepageContent.includes('EarthGlobe') &&
  searchHomepageContent.includes('SearchBar') &&
  searchHomepageContent.includes('ANVESHA'),
  "Homepage layout altered"
);

console.log("------------------------------------------------------------------");
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(">>> ALL MINIMAL SIDEBAR & DRAWER VERIFICATIONS PASSED! <<<");
}
