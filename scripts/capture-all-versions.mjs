// scripts/capture-all-versions.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log("=== CAPTURING MULTI-VERSION 3D GLOBE SCREENSHOTS ===");

const targets = [
  { name: 'v1_classic_1280x800.png', style: 'classic', w: 1280, h: 800 },
  { name: 'v2_realistic_1280x800.png', style: 'realistic', w: 1280, h: 800 },
  { name: 'v3_holographic_1280x800.png', style: 'holographic', w: 1280, h: 800 },
  { name: 'v3_mobile_360x780.png', style: 'holographic', w: 360, h: 780 },
  { name: 'v3_mobile_390x844.png', style: 'holographic', w: 390, h: 844 },
  { name: 'v3_tablet_768x1024.png', style: 'holographic', w: 768, h: 1024 },
];

for (const t of targets) {
  const filePath = path.join(outDir, t.name);
  console.log(`Rendering & capturing: ${t.name} (Style: ${t.style}, ${t.w}x${t.h})...`);
  try {
    const url = `http://localhost:5173/?globeStyle=${t.style}`;
    const cmd = `google-chrome --headless=new --screenshot="${filePath}" --window-size=${t.w},${t.h} --virtual-time-budget=4000 "${url}"`;
    execSync(cmd, { stdio: 'pipe' });
    console.log(`✓ Saved ${t.name} (${fs.statSync(filePath).size} bytes)`);
  } catch (err) {
    console.error(`Failed to capture ${t.name}:`, err.message);
  }
}

console.log("=== ALL CAPTURES COMPLETE ===");
