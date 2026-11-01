// scripts/capture-baseline.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log("Capturing baseline screenshots for V1 and V2...");

// Capture V2 (current default)
console.log("Capturing V2 baseline (Realistic Immersive)...");
execSync(`google-chrome --headless=new --screenshot="${outDir}/v2_baseline_1280x800.png" --window-size=1280,800 --virtual-time-budget=4000 http://localhost:5173`, { stdio: 'inherit' });

console.log("Baseline captured successfully.");
