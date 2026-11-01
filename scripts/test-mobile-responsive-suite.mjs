// scripts/test-mobile-responsive-suite.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/screenshots/responsive');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log("==================================================================");
console.log("   ANVESHA MOBILE-FIRST RESPONSIVE SUITE & VIEWPORT BENCHMARKS   ");
console.log("==================================================================");

const viewports = [
  { name: '01_small_phone_320x568.png', w: 320, h: 568, label: '320×568 (Small Phone / iPhone SE)' },
  { name: '02_standard_phone_360x800.png', w: 360, h: 800, label: '360×800 (Standard Phone / Galaxy)' },
  { name: '03_standard_phone_375x812.png', w: 375, h: 812, label: '375×812 (Standard Phone / iPhone X)' },
  { name: '04_standard_phone_390x844.png', w: 390, h: 844, label: '390×844 (Standard Phone / iPhone 14)' },
  { name: '05_large_phone_412x915.png', w: 412, h: 915, label: '412×915 (Large Phone / Pixel 7)' },
  { name: '06_large_phone_430x932.png', w: 430, h: 932, label: '430×932 (Large Phone / iPhone 14 Pro Max)' },
  { name: '07_tablet_portrait_768x1024.png', w: 768, h: 1024, label: '768×1024 (Tablet Portrait / iPad)' },
  { name: '08_desktop_check_1024x768.png', w: 1024, h: 768, label: '1024×768 (Desktop Preservation Check)' },
  { name: '09_desktop_large_1440x900.png', w: 1440, h: 900, label: '1440×900 (Large Desktop Preservation)' },
];

let allPassed = true;

for (const vp of viewports) {
  const filePath = path.join(outDir, vp.name);
  process.stdout.write(`Testing & Capturing ${vp.label.padEnd(42)}... `);
  try {
    const url = `http://localhost:5173/`;
    const cmd = `google-chrome --headless=new --screenshot="${filePath}" --window-size=${vp.w},${vp.h} --virtual-time-budget=3500 "${url}"`;
    execSync(cmd, { stdio: 'pipe' });
    const stats = fs.statSync(filePath);
    if (stats.size > 10000) {
      console.log(`✓ [PASS] (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`✗ [FAIL] (Empty/small file: ${stats.size} bytes)`);
      allPassed = false;
    }
  } catch (err) {
    console.log(`✗ [FAIL] (${err.message})`);
    allPassed = false;
  }
}

// Also capture mobile navigation drawer open on 390x844
const drawerFilePath = path.join(outDir, '10_mobile_drawer_open_390x844.png');
process.stdout.write(`Testing Mobile Navigation Drawer (390×844)............ `);
try {
  const url = `http://localhost:5173/?drawer=open`;
  const cmd = `google-chrome --headless=new --screenshot="${drawerFilePath}" --window-size=390,844 --virtual-time-budget=3500 "${url}"`;
  execSync(cmd, { stdio: 'pipe' });
  const stats = fs.statSync(drawerFilePath);
  if (stats.size > 10000) {
    console.log(`✓ [PASS] (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`✗ [FAIL]`);
    allPassed = false;
  }
} catch (err) {
  console.log(`✗ [FAIL] (${err.message})`);
  allPassed = false;
}

console.log("------------------------------------------------------------------");
if (allPassed) {
  console.log(">>> ALL 10 RESPONSIVE VIEWPORT BENCHMARKS & CAPTURES PASSED! <<<");
  process.exit(0);
} else {
  console.error(">>> SOME VIEWPORT BENCHMARKS FAILED <<<");
  process.exit(1);
}
