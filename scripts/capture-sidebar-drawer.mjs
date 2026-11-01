// scripts/capture-sidebar-drawer.mjs
import { execSync } from 'child_process';
import path from 'path';

const outDir = path.resolve('docs/screenshots');

console.log("=== CAPTURING MINIMAL SIDEBAR & NAVIGATION DRAWER SCREENSHOTS ===");

// 1. Initial screen (no expanded sidebar)
console.log("1. Capturing initial clean homepage (No expanded sidebar)...");
execSync(`google-chrome --headless=new --screenshot="${outDir}/minimal_home_no_sidebar_1280x800.png" --window-size=1280,800 --virtual-time-budget=4000 "http://localhost:5173"`, { stdio: 'inherit' });

console.log("=== CAPTURE COMPLETE ===");
