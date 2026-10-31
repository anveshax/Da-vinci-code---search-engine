import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as topojson from 'topojson-client';
import * as d3 from 'd3-geo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read world-atlas 110m land TopoJSON
const worldAtlasPath = path.resolve(__dirname, '../frontend/node_modules/world-atlas/land-110m.json');
const world = JSON.parse(fs.readFileSync(worldAtlasPath, 'utf8'));

// Convert TopoJSON to GeoJSON
const land = topojson.feature(world, world.objects.land);

console.log('Generating Fibonacci candidate sphere points...');

// Target ~25,000 land points
// Total candidate points ~86,000 (Earth land fraction ~29%)
const TOTAL_CANDIDATES = 88000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996323

const landPoints = [];

for (let i = 0; i < TOTAL_CANDIDATES; i++) {
  const y = 1 - (i / (TOTAL_CANDIDATES - 1)) * 2; // from 1 to -1
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN_ANGLE * i;

  const x = Math.cos(theta) * radiusAtY;
  const z = Math.sin(theta) * radiusAtY;

  // Convert (x, y, z) on unit sphere to spherical (lat, lon) in degrees
  // Three.js convention: Y is up (North pole), Z is forward, X is right
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
  // Lon from -180 to 180 degrees
  const lon = Math.atan2(x, z) * (180 / Math.PI);

  if (d3.geoContains(land, [lon, lat])) {
    // Store as rounded floats to 4 decimals to keep JSON size compact
    landPoints.push(
      Math.round(x * 10000) / 10000,
      Math.round(y * 10000) / 10000,
      Math.round(z * 10000) / 10000
    );
  }
}

const pointCount = landPoints.length / 3;
console.log(`Generated ${pointCount} land points (target ~25,000).`);

// Also sample coastline mesh points for extra edge density
console.log('Sampling coastline mesh points for enhanced coastline definition...');
const coastlines = topojson.mesh(world, world.objects.land);

function sampleLineString(coords, step = 1.2) {
  for (let j = 0; j < coords.length - 1; j++) {
    const [lon1, lat1] = coords[j];
    const [lon2, lat2] = coords[j + 1];
    const dLon = lon2 - lon1;
    const dLat = lat2 - lat1;
    const dist = Math.sqrt(dLon * dLon + dLat * dLat);
    const steps = Math.max(1, Math.floor(dist / step));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const lon = lon1 + dLon * t;
      const lat = lat1 + dLat * t;

      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);

      const y = Math.cos(phi);
      const x = Math.sin(phi) * Math.sin(theta);
      const z = Math.sin(phi) * Math.cos(theta);

      landPoints.push(
        Math.round(x * 10000) / 10000,
        Math.round(y * 10000) / 10000,
        Math.round(z * 10000) / 10000
      );
    }
  }
}

if (coastlines.type === 'MultiLineString') {
  for (const line of coastlines.coordinates) {
    sampleLineString(line, 2.5); // sparse coastline interpolation
  }
}

const totalPoints = landPoints.length / 3;
console.log(`Total points with coastline emphasis: ${totalPoints}`);

// Write output to frontend/public/data/land-points.json
const outputDir = path.resolve(__dirname, '../frontend/public/data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'land-points.json');
fs.writeFileSync(outputPath, JSON.stringify(landPoints));

const stats = fs.statSync(outputPath);
console.log(`Successfully saved ${totalPoints} points to ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
