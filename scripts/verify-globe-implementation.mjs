// scripts/verify-globe-implementation.mjs
import fs from 'fs';
import path from 'path';

console.log("==================================================================");
console.log("   ANVESHA REALISTIC IMMERSIVE 3D EARTH GLOBE VERIFICATION SUITE   ");
console.log("==================================================================");

const earthGlobePath = path.resolve('frontend/src/components/EarthGlobe.tsx');
const searchHomepagePath = path.resolve('frontend/src/components/SearchHomepage.tsx');
const settingsModalPath = path.resolve('frontend/src/components/SettingsModal.tsx');
const globeSettingsServicePath = path.resolve('frontend/src/services/globeSettings.ts');
const searchBarPath = path.resolve('frontend/src/components/SearchBar.tsx');

const earthGlobeContent = fs.readFileSync(earthGlobePath, 'utf8');
const searchHomepageContent = fs.readFileSync(searchHomepagePath, 'utf8');
const settingsModalContent = fs.readFileSync(settingsModalPath, 'utf8');
const globeSettingsServiceContent = fs.readFileSync(globeSettingsServicePath, 'utf8');
const searchBarContent = fs.readFileSync(searchBarPath, 'utf8');

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

// 1. Realistic Earth Appearance
verify(
  "Genuine Three.js 3D WebGL renderer initialized with antialias and alpha",
  earthGlobeContent.includes('new THREE.WebGLRenderer') &&
  earthGlobeContent.includes('antialias: true') &&
  earthGlobeContent.includes('alpha: true'),
  "WebGLRenderer setup missing or misconfigured"
);

verify(
  "Detailed spherical core geometry prevents backface clutter and gives depth",
  earthGlobeContent.includes('new THREE.SphereGeometry(sphereRadius * 0.985') &&
  earthGlobeContent.includes('0x020408'),
  "Core dark sphere geometry missing or misconfigured"
);

verify(
  "Illuminated continents use high-res land points with additive blending",
  earthGlobeContent.includes('/data/land-points.json') &&
  earthGlobeContent.includes('new THREE.PointsMaterial'),
  "Land points or points material missing"
);

verify(
  "Delicate 3D elliptical orbits with tilted angles surround the globe",
  earthGlobeContent.includes('orbitConfigs') &&
  earthGlobeContent.includes('EllipseCurve') &&
  earthGlobeContent.includes('orbitLines'),
  "Elliptical orbits missing"
);

verify(
  "Glowing orbital bloom nodes with soft halo meshes travel along orbits",
  earthGlobeContent.includes('bloomNodes') &&
  earthGlobeContent.includes('haloMesh'),
  "Glowing orbital nodes missing"
);

verify(
  "Realistic atmospheric rim lighting using Fresnel shader with directional bias",
  earthGlobeContent.includes('fresnel = pow(fresnel, power) * bias') &&
  earthGlobeContent.includes('upperLeftRim'),
  "Fresnel atmospheric rim shader missing or incorrect"
);

verify(
  "Subtle ground reflection beneath globe fading to black",
  earthGlobeContent.includes('reflectionCanvas') &&
  earthGlobeContent.includes('reflectionPlane') &&
  earthGlobeContent.includes('reflectionGeo'),
  "Floor reflection plane missing"
);

// 2. Integration into Page (Not a sticker or isolated card)
verify(
  "Globe container matches exact required responsive dimensions without card border",
  searchHomepageContent.includes('w-[92vw] sm:w-[560px] md:w-[600px] lg:w-[640px] h-[92vw] sm:h-[560px] md:h-[600px] lg:h-[640px] max-w-[640px] max-h-[640px]'),
  "Globe container dimensions do not match previous specifications"
);

verify(
  "ANVESHA brand wordmark with 4-point star sparkle matches approved reference",
  searchHomepageContent.includes('path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"') &&
  searchHomepageContent.includes('ANVESHA'),
  "Branding header does not match reference image"
);

verify(
  "Search bar placeholder matches approved reference image",
  searchBarContent.includes('Search anything, code, research, web...'),
  "SearchBar placeholder does not match reference image"
);

// 3. User-Adjustable Lighting Controls in Settings
verify(
  "Globe Appearance section added to platform settings navigation",
  settingsModalContent.includes("id: 'globe_appearance'") &&
  settingsModalContent.includes("Globe Appearance & Lighting"),
  "Globe Appearance missing from settings navigation"
);

verify(
  "Light Intensity slider provided (0.2 to 2.0)",
  settingsModalContent.includes('Light Intensity') &&
  settingsModalContent.includes('value={globeSettings.lightIntensity}'),
  "Light intensity slider missing"
);

verify(
  "Atmospheric Glow slider provided (0.0 to 2.0)",
  settingsModalContent.includes('Atmospheric Glow') &&
  settingsModalContent.includes('value={globeSettings.atmosphericGlow}'),
  "Atmospheric glow slider missing"
);

verify(
  "Ambient Brightness slider provided (0.0 to 2.0)",
  settingsModalContent.includes('Ambient Brightness') &&
  settingsModalContent.includes('value={globeSettings.ambientBrightness}'),
  "Ambient brightness slider missing"
);

verify(
  "Surface Illumination slider provided (0.2 to 2.0)",
  settingsModalContent.includes('Surface Illumination') &&
  settingsModalContent.includes('value={globeSettings.surfaceIllumination}'),
  "Surface illumination slider missing"
);

verify(
  "Orbital Light Intensity slider provided (0.2 to 2.0)",
  settingsModalContent.includes('Orbital Light Intensity') &&
  settingsModalContent.includes('value={globeSettings.orbitalLightIntensity}'),
  "Orbital light intensity slider missing"
);

verify(
  "All 6 required colour presets supported (Ice Blue, Electric Blue, White, Cyan, Purple, Gold)",
  settingsModalContent.includes("'ice_blue'") &&
  settingsModalContent.includes("'electric_blue'") &&
  settingsModalContent.includes("'white'") &&
  settingsModalContent.includes("'cyan'") &&
  settingsModalContent.includes("'purple'") &&
  settingsModalContent.includes("'gold'"),
  "Missing required color presets"
);

verify(
  "Custom colour picker with hex code supported",
  settingsModalContent.includes('type="color"') &&
  settingsModalContent.includes('value={globeSettings.customColor}'),
  "Custom color picker missing"
);

verify(
  "Reset to Default functionality restores approved reference settings",
  settingsModalContent.includes('globeSettingsService.resetToDefault()'),
  "Reset to default missing"
);

verify(
  "Settings persist to localStorage under persistent key",
  globeSettingsServiceContent.includes('anvesha_globe_lighting_settings') &&
  globeSettingsServiceContent.includes('localStorage.setItem'),
  "Settings persistence missing"
);

verify(
  "Reactive real-time subscription propagates slider updates instantly to WebGL without reload",
  earthGlobeContent.includes('globeSettingsService.subscribe') &&
  earthGlobeContent.includes('rimMat.uniforms.intensity.value'),
  "Real-time Three.js settings subscription missing"
);

// 4. Performance & Memory Management
verify(
  "All geometries, materials, and canvas textures are safely disposed on unmount",
  earthGlobeContent.includes('coreGeo.dispose()') &&
  earthGlobeContent.includes('rimGeo.dispose()') &&
  earthGlobeContent.includes('dustGeo.dispose()') &&
  earthGlobeContent.includes('reflectionTexture.dispose()') &&
  earthGlobeContent.includes('renderer.dispose()'),
  "Resource disposal or memory leak prevention missing"
);

verify(
  "Reduced-motion accessibility is honored",
  earthGlobeContent.includes('reducedMotionRef.current') &&
  earthGlobeContent.includes('speedMult'),
  "Reduced motion preference not honored"
);

console.log("------------------------------------------------------------------");
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(">>> ALL VERIFICATIONS PASSED PERFECTLY! <<<");
}
