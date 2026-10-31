import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as topojson from 'topojson-client';
import * as d3 from 'd3-geo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read world-atlas 110m land TopoJSON
const worldAtlasPath = path.resolve(__dirname, '../node_modules/world-atlas/land-110m.json');
const world = JSON.parse(fs.readFileSync(worldAtlasPath, 'utf8'));

// Convert TopoJSON to GeoJSON
const land = topojson.feature(world, world.objects.land);

// Extract individual polygons with fast pre-computed bounding boxes
const polygons = [];

function extractPolygons(geom) {
  if (geom.type === 'Polygon') {
    const bounds = d3.geoBounds(geom);
    polygons.push({
      geom,
      minLon: bounds[0][0],
      minLat: bounds[0][1],
      maxLon: bounds[1][0],
      maxLat: bounds[1][1],
    });
  } else if (geom.type === 'MultiPolygon') {
    for (const coords of geom.coordinates) {
      const poly = { type: 'Polygon', coordinates: coords };
      const bounds = d3.geoBounds(poly);
      polygons.push({
        geom: poly,
        minLon: bounds[0][0],
        minLat: bounds[0][1],
        maxLon: bounds[1][0],
        maxLat: bounds[1][1],
      });
    }
  } else if (geom.type === 'Feature') {
    extractPolygons(geom.geometry);
  } else if (geom.type === 'FeatureCollection') {
    for (const f of geom.features) {
      extractPolygons(f.geometry);
    }
  }
}

extractPolygons(land);
console.log(`Extracted ${polygons.length} land polygons with pre-computed bounding boxes.`);

function isLand(lon, lat) {
  for (let i = 0; i < polygons.length; i++) {
    const p = polygons[i];
    // Check bounding box first (almost instant)
    if (lat < p.minLat || lat > p.maxLat) continue;

    // Handle normal bounding box vs anti-meridian wrapping
    if (p.minLon <= p.maxLon) {
      if (lon < p.minLon || lon > p.maxLon) continue;
    } else {
      // Crosses anti-meridian
      if (lon < p.minLon && lon > p.maxLon) continue;
    }

    // Candidate is within bounding box, do exact point-in-polygon check
    if (d3.geoContains(p.geom, [lon, lat])) {
      return true;
    }
  }
  return false;
}

console.log('Generating Fibonacci candidate sphere points...');

// Target ~25,000 land points
const TOTAL_CANDIDATES = 88000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996323

const landPoints = [];

for (let i = 0; i < TOTAL_CANDIDATES; i++) {
  const y = 1 - (i / (TOTAL_CANDIDATES - 1)) * 2; // from 1 to -1
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN_ANGLE * i;

  const x = Math.cos(theta) * radiusAtY;
  const z = Math.sin(theta) * radiusAtY;

  // Convert (x, y, z) to spherical (lat, lon) in degrees
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
  const lon = Math.atan2(x, z) * (180 / Math.PI);

  if (isLand(lon, lat)) {
    landPoints.push(
      Math.round(x * 10000) / 10000,
      Math.round(y * 10000) / 10000,
      Math.round(z * 10000) / 10000
    );
  }
}

const pointCount = landPoints.length / 3;
console.log(`Generated ${pointCount} interior land points.`);

// Also sample coastline mesh points for denser, crisp coastlines
console.log('Sampling coastline mesh points for enhanced edge definition...');
const coastlines = topojson.mesh(world, world.objects.land);

function sampleLineString(coords, step = 3.0) {
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
      const theta = (lon) * (Math.PI / 180);

      const y = Math.sin(lat * (Math.PI / 180));
      const radAtY = Math.cos(lat * (Math.PI / 180));
      const x = Math.sin(theta) * radAtY;
      const z = Math.cos(theta) * radAtY;

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
    sampleLineString(line, 2.8);
  }
}

const totalPoints = landPoints.length / 3;
console.log(`Total points with coastline emphasis: ${totalPoints}`);

// Write output to frontend/public/data/land-points.json
const outputDir = path.resolve(__dirname, '../public/data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'land-points.json');
fs.writeFileSync(outputPath, JSON.stringify(landPoints));

const stats = fs.statSync(outputPath);
console.log(`Successfully saved ${totalPoints} points to ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
