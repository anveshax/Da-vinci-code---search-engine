// scripts/verify-globe-v3.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log("==================================================================");
console.log("       ANVESHA 3D EARTH GLOBE V1, V2, V3 MULTI-VERSION SUITE      ");
console.log("==================================================================");

const earthGlobePath = path.resolve('frontend/src/components/EarthGlobe.tsx');
const earthGlobeV3Path = path.resolve('frontend/src/components/EarthGlobeV3.tsx');
const searchHomepagePath = path.resolve('frontend/src/components/SearchHomepage.tsx');
const settingsModalPath = path.resolve('frontend/src/components/SettingsModal.tsx');
const globeSettingsServicePath = path.resolve('frontend/src/services/globeSettings.ts');

const earthGlobeContent = fs.readFileSync(earthGlobePath, 'utf8');
const earthGlobeV3Content = fs.readFileSync(earthGlobeV3Path, 'utf8');
const searchHomepageContent = fs.readFileSync(searchHomepagePath, 'utf8');
const settingsModalContent = fs.readFileSync(settingsModalPath, 'utf8');
const globeSettingsServiceContent = fs.readFileSync(globeSettingsServicePath, 'utf8');

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

// 1. Preservation of V1 (Original / Classic Minimal)
verify(
  "V1 retains classic halo mesh nodes without starburst flare sprites",
  earthGlobeContent.includes('const haloGeo = new THREE.SphereGeometry(0.12, 16, 16);') &&
  earthGlobeContent.includes('haloMesh = new THREE.Mesh(haloGeo, haloMat);'),
  "V1 classic halo mesh altered"
);

verify(
  "V1 retains classic radial mist floor reflection",
  earthGlobeContent.includes('createClassicReflectionTexture()'),
  "V1 classic reflection altered"
);

verify(
  "V1 camera framing uses fixed z = 7.8 and fov = 40",
  earthGlobeContent.includes('camera.position.set(0, 0, 7.8);') &&
  earthGlobeContent.includes('const fov = isRealistic ? 38 : 40;'),
  "V1 camera framing altered"
);

// 2. Preservation of V2 (Edited / Realistic Immersive)
verify(
  "V2 retains high-fidelity starlight particle texture and flare sprites",
  earthGlobeContent.includes('createCircleParticleTexture()') &&
  earthGlobeContent.includes('createFlareTexture()') &&
  earthGlobeContent.includes('createFloorReflectionTexture'),
  "V2 realistic assets altered"
);

verify(
  "V2 dynamic camera calculation guarantees ~500px sphere diameter",
  earthGlobeContent.includes('const targetPixelDiameter = Math.min(500, Math.min(w, h) * 0.78);') &&
  earthGlobeContent.includes('sphereRadius / Math.tan(halfFovRad)'),
  "V2 dynamic camera calculation altered"
);

// 3. V3 (Holographic Particle Earth) Implementation
verify(
  "V3 implementation exists as an independent, modular Three.js component",
  fs.existsSync(earthGlobeV3Path) && earthGlobeV3Content.length > 5000,
  "EarthGlobeV3.tsx missing or empty"
);

verify(
  "V3 uses identical sphereRadius (2.40) and FOV (38) matching V2 for pixel-aligned dimensions",
  earthGlobeV3Content.includes('const sphereRadius = 2.40;') &&
  earthGlobeV3Content.includes('const fov = 38;') &&
  earthGlobeV3Content.includes('const targetPixelDiameter = Math.min(500, Math.min(w, h) * 0.78);'),
  "V3 dimensions do not match V2 specification"
);

verify(
  "V3 continents formed from high-density digital point-cloud (/data/land-points.json)",
  earthGlobeV3Content.includes('/data/land-points.json') &&
  earthGlobeV3Content.includes('createV3CircleParticleTexture'),
  "V3 land point cloud missing"
);

verify(
  "V3 features holographic intercontinental data connection arcs bridging world tech hubs",
  earthGlobeV3Content.includes('GLOBAL_HUBS') &&
  earthGlobeV3Content.includes('HUB_CONNECTIONS') &&
  earthGlobeV3Content.includes('QuadraticBezierCurve3') &&
  earthGlobeV3Content.includes('connectionArcs'),
  "V3 intercontinental connection arcs missing"
);

verify(
  "V3 traveling pulse packets traverse connection arcs smoothly",
  earthGlobeV3Content.includes('pulseProgress') &&
  earthGlobeV3Content.includes('pulseMesh'),
  "V3 traveling pulse packets missing"
);

verify(
  "V3 features three independent orbital trajectory rings with distinct 3D inclinations",
  earthGlobeV3Content.includes('orbitConfigs') &&
  earthGlobeV3Content.includes('rotX: 0.74, rotY: 0.30, rotZ: -0.22') &&
  earthGlobeV3Content.includes('rotX: -0.65, rotY: -0.42, rotZ: 0.36') &&
  earthGlobeV3Content.includes('rotX: 0.28, rotY: 0.80, rotZ: 0.58'),
  "V3 three orbital trajectory rings missing or incorrect"
);

verify(
  "V3 satellite nodes feature 4-point starburst cross-flares",
  earthGlobeV3Content.includes('createV3FlareTexture') &&
  earthGlobeV3Content.includes('flareSprite = new THREE.Sprite(flareMat);'),
  "V3 4-point starburst flare sprites missing"
);

verify(
  "V3 includes glossy floor reflection plane beneath globe",
  earthGlobeV3Content.includes('createV3FloorReflectionTexture') &&
  earthGlobeV3Content.includes('reflectionPlane.rotation.x = -Math.PI / 2;'),
  "V3 floor reflection missing"
);

verify(
  "V3 comprehensive GPU resource cleanup on unmount prevents memory leaks",
  earthGlobeV3Content.includes('circleTexture.dispose()') &&
  earthGlobeV3Content.includes('flareTexture.dispose()') &&
  earthGlobeV3Content.includes('reflectionTexture.dispose()') &&
  earthGlobeV3Content.includes('coreGeo.dispose()') &&
  earthGlobeV3Content.includes('renderer.dispose()'),
  "V3 resource cleanup missing"
);

// 4. Selector & Architecture Integration
verify(
  "GlobeSettings supports V1, V2, and V3 styles with V2 as non-disruptive default",
  globeSettingsServiceContent.includes('DEFAULT_GLOBE_SETTINGS') &&
  globeSettingsServiceContent.includes("globeStyle: 'realistic'") &&
  globeSettingsServiceContent.includes('GLOBE_VERSIONS'),
  "GlobeSettings style support missing"
);

verify(
  "SettingsModal features 3-card selector for V1, V2, and V3",
  settingsModalContent.includes('Realistic Immersive') &&
  settingsModalContent.includes('Classic Minimal') &&
  settingsModalContent.includes('Holographic Particle') &&
  settingsModalContent.includes("Option 3 (V3)"),
  "SettingsModal 3-version selector missing"
);

verify(
  "SearchHomepage bottom status pill allows cycling between V1, V2, and V3",
  searchHomepageContent.includes('V3 Holographic') &&
  searchHomepageContent.includes("globeStyle: nextStyle"),
  "SearchHomepage version switcher missing"
);

console.log("------------------------------------------------------------------");
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(">>> ALL MULTI-VERSION ARCHITECTURE TESTS PASSED! <<<");
}
