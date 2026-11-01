import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audioService } from '../services/audioService';
import {
  globeSettingsService,
  GlobeSettings,
  resolvePalette,
} from '../services/globeSettings';

export interface EarthGlobeV3Props {
  isSearching?: boolean;
  reducedMotion?: boolean;
  onNodePulse?: (pulseFn: () => void) => void;
  className?: string;
}

// Procedural soft-circular particle texture for holographic continent point cloud
function createV3CircleParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(235, 245, 255, 0.92)');
    grad.addColorStop(0.5, 'rgba(160, 210, 255, 0.42)');
    grad.addColorStop(0.8, 'rgba(90, 160, 255, 0.10)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Procedural 4-point starburst cross-flare texture for holographic satellite nodes
function createV3FlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Soft radial core
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.12, 'rgba(230, 245, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(140, 195, 255, 0.3)');
    grad.addColorStop(0.7, 'rgba(70, 140, 255, 0.06)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    // Horizontal diffraction spike
    const hGrad = ctx.createLinearGradient(0, 64, 128, 64);
    hGrad.addColorStop(0.0, 'rgba(180, 220, 255, 0.0)');
    hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    hGrad.addColorStop(1.0, 'rgba(180, 220, 255, 0.0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 62, 128, 4);

    // Vertical diffraction spike
    const vGrad = ctx.createLinearGradient(64, 0, 64, 128);
    vGrad.addColorStop(0.0, 'rgba(180, 220, 255, 0.0)');
    vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    vGrad.addColorStop(1.0, 'rgba(180, 220, 255, 0.0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(62, 0, 4, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Procedural vertical streak floor reflection texture
function createV3FloorReflectionTexture(floorColorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const floorCol = new THREE.Color(floorColorHex);
    const r = Math.round(floorCol.r * 255);
    const g = Math.round(floorCol.g * 255);
    const b = Math.round(floorCol.b * 255);

    ctx.clearRect(0, 0, 512, 512);

    const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.38)`);
    grad.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.22)`);
    grad.addColorStop(0.48, `rgba(${r}, ${g}, ${b}, 0.07)`);
    grad.addColorStop(0.78, `rgba(4, 8, 18, 0.02)`);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.save();
    ctx.translate(256, 256);
    ctx.scale(1.4, 0.65);
    ctx.translate(-256, -256);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Helper: Convert Lat/Long (degrees) to 3D Cartesian coordinates on sphere
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Major global network hubs for holographic intercontinental data connection arcs
const GLOBAL_HUBS = [
  { name: 'New York', lat: 40.71, lon: -74.00 },
  { name: 'San Francisco', lat: 37.77, lon: -122.41 },
  { name: 'London', lat: 51.50, lon: -0.12 },
  { name: 'Tokyo', lat: 35.67, lon: 139.65 },
  { name: 'Singapore', lat: 1.35, lon: 103.81 },
  { name: 'Sydney', lat: -33.86, lon: 151.20 },
  { name: 'Sao Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Frankfurt', lat: 50.11, lon: 8.68 },
  { name: 'Mumbai', lat: 19.07, lon: 72.87 },
  { name: 'Johannesburg', lat: -26.20, lon: 28.04 },
];

const HUB_CONNECTIONS = [
  [0, 2], // New York <-> London
  [1, 3], // San Francisco <-> Tokyo
  [2, 7], // London <-> Frankfurt
  [7, 8], // Frankfurt <-> Mumbai
  [8, 4], // Mumbai <-> Singapore
  [4, 3], // Singapore <-> Tokyo
  [4, 5], // Singapore <-> Sydney
  [0, 6], // New York <-> Sao Paulo
  [7, 9], // Frankfurt <-> Johannesburg
];

export const EarthGlobeV3: React.FC<EarthGlobeV3Props> = ({
  isSearching = false,
  reducedMotion = false,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isSearchingRef = useRef(isSearching);
  const reducedMotionRef = useRef(reducedMotion);
  const settingsRef = useRef<GlobeSettings>(globeSettingsService.getSettings());

  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let animationFrameId: number;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Exact Camera Framing matching V1 and V2
    const scene = new THREE.Scene();
    scene.background = null;

    const sphereRadius = 2.40;
    const fov = 38;
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1000);

    const updateCamera = (w: number, h: number) => {
      if (w >= 1024) {
        // Desktop / Laptop: strict preservation of original desktop framing
        const targetPixelDiameter = Math.min(500, Math.min(w, h) * 0.78);
        const halfFovRad = (fov / 2) * (Math.PI / 180);
        const zDist = (sphereRadius / Math.tan(halfFovRad)) * (h / targetPixelDiameter);
        camera.position.set(0, 0, Math.max(7.2, Math.min(10.5, zDist)));
      } else {
        // Mobile & Tablet: responsive viewport-aware camera calculation
        const isPortrait = h > w;
        const targetPixelDiameter = isPortrait
          ? Math.min(w * 0.52, Math.min(h * 0.30, 220))
          : Math.min(h * 0.50, 240);
        const halfFovRad = (fov / 2) * (Math.PI / 180);
        const zDist = (sphereRadius / Math.tan(halfFovRad)) * (h / Math.max(120, targetPixelDiameter));
        camera.position.set(0, 0, Math.max(7.8, Math.min(32.0, zDist)));
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    updateCamera(width, height);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    const isMobileDevice = width < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.75 : 2));
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Initial globe orientation matching reference
    globeGroup.rotation.y = -Math.PI * 0.42;
    globeGroup.rotation.x = 0.10;

    const circleTexture = createV3CircleParticleTexture();
    const flareTexture = createV3FlareTexture();
    let currentPalette = resolvePalette(settingsRef.current);
    let reflectionTexture = createV3FloorReflectionTexture(currentPalette.floor);

    // 2. Dark Opaque Core Sphere (Prevents cluttered backface overlap)
    const coreGeo = new THREE.SphereGeometry(sphereRadius * 0.988, 48, 48);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x010308,
      transparent: true,
      opacity: 0.96 * settingsRef.current.ambientBrightness,
      depthWrite: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // 3. Atmospheric Rim Lighting Shader Shell (Upper-left key light)
    const rimGeo = new THREE.SphereGeometry(sphereRadius * 1.018, 54, 54);
    const rimMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color(currentPalette.rim) },
        coreColor: { value: new THREE.Color(0xffffff) },
        bias: { value: 1.15 * settingsRef.current.atmosphericGlow },
        power: { value: 3.1 },
        lightPos: { value: new THREE.Vector3(-0.55, 0.72, 0.42).normalize() },
        searchBoost: { value: 0.0 },
        intensity: { value: settingsRef.current.lightIntensity },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 coreColor;
        uniform float bias;
        uniform float power;
        uniform vec3 lightPos;
        uniform float searchBoost;
        uniform float intensity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float vDotN = max(0.0, dot(normal, viewDir));
          float fresnel = pow(1.0 - vDotN, power) * bias;
          float dirIntensity = max(0.0, dot(normal, lightPos));
          float upperRim = fresnel * (0.34 + 0.86 * dirIntensity);
          vec3 col = mix(glowColor, coreColor, fresnel * 0.55);
          float alpha = clamp(upperRim * (0.70 + searchBoost * 0.42) * intensity, 0.0, 0.96);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    scene.add(rimMesh);

    // 4. Dot-Matrix Land Points Cloud (Continents from thousands of tiny luminous particles)
    let landPointsGeo: THREE.BufferGeometry | null = null;
    let landPointsMat: THREE.PointsMaterial | null = null;
    let landParticles: THREE.Points | null = null;

    const setupLandPoints = (coords: number[]) => {
      if (isDisposed) return;
      const totalPoints = coords.length / 3;
      const step = reducedMotionRef.current ? 2 : 1;
      const count = Math.floor(totalPoints / step);

      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      const white = new THREE.Color(currentPalette.primary);
      const accent = new THREE.Color(currentPalette.secondary);
      const rimCol = new THREE.Color(currentPalette.rim);

      let targetIdx = 0;
      for (let i = 0; i < totalPoints; i += step) {
        const x = coords[i * 3];
        const y = coords[i * 3 + 1];
        const z = coords[i * 3 + 2];

        // Slight height variation for digital holographic depth
        const rad = sphereRadius * (1.0 + Math.random() * 0.007);
        positions[targetIdx * 3] = x * rad;
        positions[targetIdx * 3 + 1] = y * rad;
        positions[targetIdx * 3 + 2] = z * rad;

        const rand = Math.random();
        let c: THREE.Color;
        if (rand < 0.65) {
          c = white.clone().lerp(accent, Math.random() * 0.32);
        } else if (rand < 0.92) {
          c = accent.clone().lerp(rimCol, Math.random() * 0.4);
        } else {
          c = white;
        }

        colors[targetIdx * 3] = c.r;
        colors[targetIdx * 3 + 1] = c.g;
        colors[targetIdx * 3 + 2] = c.b;
        targetIdx++;
      }

      landPointsGeo = new THREE.BufferGeometry();
      landPointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      landPointsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      landPointsMat = new THREE.PointsMaterial({
        size: 0.046 * settingsRef.current.surfaceIllumination,
        map: circleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.94 * settingsRef.current.lightIntensity * settingsRef.current.surfaceIllumination,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      landParticles = new THREE.Points(landPointsGeo, landPointsMat);
      globeGroup.add(landParticles);
    };

    fetch('/data/land-points.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load land points data');
        return res.json();
      })
      .then((coords: number[]) => {
        setupLandPoints(coords);
      })
      .catch((err) => {
        console.warn('Fallback: Generating procedural Fibonacci Earth points', err);
        const fallbackCount = 12000;
        const coords: number[] = [];
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < fallbackCount; i++) {
          const y = 1 - (i / (fallbackCount - 1)) * 2;
          const r = Math.sqrt(Math.max(0, 1 - y * y));
          const theta = golden * i;
          coords.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        }
        setupLandPoints(coords);
      });

    // 5. Intercontinental Holographic Data Connection Arcs & Traveling Pulse Nodes
    const connectionGroup = new THREE.Group();
    globeGroup.add(connectionGroup);

    interface ConnectionArc {
      curve: THREE.QuadraticBezierCurve3;
      pulseProgress: number;
      pulseSpeed: number;
      pulseMesh: THREE.Mesh;
    }

    const connectionArcs: ConnectionArc[] = [];
    const arcLines: THREE.Line[] = [];

    HUB_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const h1 = GLOBAL_HUBS[startIdx];
      const h2 = GLOBAL_HUBS[endIdx];

      const v1 = latLonToVector3(h1.lat, h1.lon, sphereRadius * 1.002);
      const v2 = latLonToVector3(h2.lat, h2.lon, sphereRadius * 1.002);

      // Great-circle midpoint elevated outward along normal vector
      const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      const dist = v1.distanceTo(v2);
      const elevateFactor = 1.0 + Math.min(0.24, dist * 0.055);
      mid.normalize().multiplyScalar(sphereRadius * elevateFactor);

      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      const pts = curve.getPoints(48);

      const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const arcMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(currentPalette.secondary),
        transparent: true,
        opacity: 0.32 * settingsRef.current.orbitalLightIntensity,
        blending: THREE.AdditiveBlending,
      });

      const line = new THREE.Line(arcGeo, arcMat);
      connectionGroup.add(line);
      arcLines.push(line);

      // Small glowing pulse packet traversing the arc
      const pulseGeo = new THREE.SphereGeometry(0.024, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(currentPalette.primary),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      connectionGroup.add(pulseMesh);

      connectionArcs.push({
        curve,
        pulseProgress: Math.random(),
        pulseSpeed: 0.12 + Math.random() * 0.14,
        pulseMesh,
      });
    });

    // 6. Atmospheric Dust Particle Halo (Stardust around globe)
    const dustCount = 360;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustColor = new THREE.Color(currentPalette.rim);

    for (let i = 0; i < dustCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = sphereRadius * (1.04 + Math.random() * 0.22);

      dustPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      dustPositions[i * 3 + 2] = r * Math.cos(phi);

      dustColors[i * 3] = dustColor.r * (0.6 + Math.random() * 0.4);
      dustColors[i * 3 + 1] = dustColor.g * (0.6 + Math.random() * 0.4);
      dustColors[i * 3 + 2] = dustColor.b * (0.6 + Math.random() * 0.4);
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

    const dustMat = new THREE.PointsMaterial({
      size: 0.032,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.38 * settingsRef.current.atmosphericGlow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // 7. Three Delicate 3D Elliptical Orbit Trajectory Rings
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    interface OrbitDef {
      a: number;
      b: number;
      rotX: number;
      rotY: number;
      rotZ: number;
      curve: THREE.EllipseCurve;
    }

    const orbitConfigs: OrbitDef[] = [
      { a: 3.32, b: 3.06, rotX: 0.74, rotY: 0.30, rotZ: -0.22, curve: new THREE.EllipseCurve(0, 0, 3.32, 3.06, 0, 2 * Math.PI, false, 0) },
      { a: 3.65, b: 3.25, rotX: -0.65, rotY: -0.42, rotZ: 0.36, curve: new THREE.EllipseCurve(0, 0, 3.65, 3.25, 0, 2 * Math.PI, false, 0) },
      { a: 3.90, b: 3.45, rotX: 0.28, rotY: 0.80, rotZ: 0.58, curve: new THREE.EllipseCurve(0, 0, 3.90, 3.45, 0, 2 * Math.PI, false, 0) },
    ];

    const orbitLines: THREE.Line[] = [];

    orbitConfigs.forEach((cfg) => {
      const points2D = cfg.curve.getPoints(140);
      const points3D = points2D.map((p) => new THREE.Vector3(p.x, 0, p.y));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points3D);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(currentPalette.orbit),
        transparent: true,
        opacity: 0.46 * settingsRef.current.orbitalLightIntensity * settingsRef.current.lightIntensity,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      orbitGroup.add(line);
      orbitLines.push(line);
    });

    // 8. Glowing Orbital Nodes with 4-Point Starburst Cross-Flares
    interface BloomNode {
      group: THREE.Group;
      flareSprite: THREE.Sprite;
      orbitIdx: number;
      progress: number;
      speed: number;
    }

    const bloomNodes: BloomNode[] = [];
    const nodeConfigs = [
      { orbitIdx: 0, initialT: 0.05, speed: 0.075 },
      { orbitIdx: 0, initialT: 0.58, speed: 0.075 },
      { orbitIdx: 1, initialT: 0.22, speed: 0.062 },
      { orbitIdx: 1, initialT: 0.78, speed: 0.062 },
      { orbitIdx: 2, initialT: 0.40, speed: 0.048 },
    ];

    nodeConfigs.forEach((nc) => {
      const nodeGroup = new THREE.Group();

      // Sharp white inner core
      const innerGeo = new THREE.SphereGeometry(0.042, 16, 16);
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      nodeGroup.add(innerMesh);

      // Starburst cross-flare sprite
      const flareMat = new THREE.SpriteMaterial({
        map: flareTexture,
        color: new THREE.Color(currentPalette.nodeFlare),
        transparent: true,
        opacity: 0.95 * settingsRef.current.orbitalLightIntensity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flareSprite = new THREE.Sprite(flareMat);
      flareSprite.scale.set(0.48, 0.48, 1.0);
      nodeGroup.add(flareSprite);

      orbitGroup.add(nodeGroup);
      bloomNodes.push({
        group: nodeGroup,
        flareSprite,
        orbitIdx: nc.orbitIdx,
        progress: nc.initialT,
        speed: nc.speed,
      });
    });

    // 9. Ground Reflection Plane
    const reflectionGeo = new THREE.PlaneGeometry(sphereRadius * 4.2, sphereRadius * 2.8);
    const reflectionMat = new THREE.MeshBasicMaterial({
      map: reflectionTexture,
      transparent: true,
      opacity: 0.72 * settingsRef.current.lightIntensity * settingsRef.current.atmosphericGlow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const reflectionPlane = new THREE.Mesh(reflectionGeo, reflectionMat);
    reflectionPlane.rotation.x = -Math.PI / 2;
    reflectionPlane.position.y = -sphereRadius - 0.48;
    scene.add(reflectionPlane);

    // 10. Interactive Pointer Tilt
    let targetTiltX = 0;
    let targetTiltY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const rect = container.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;

      targetTiltY = x * 0.48;
      targetTiltX = y * 0.38;

      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        const panX = Math.max(-1, Math.min(1, x * 2.0));
        audioService.playSphereInteraction(panX);
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
      }
      const rect = container.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const panX = Math.max(-1, Math.min(1, x * 2.0));
      audioService.playSphereInteraction(panX);
      audioService.triggerHaptic('node');
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    container.addEventListener('mousedown', handlePointerDown);
    container.addEventListener('touchstart', handlePointerDown, { passive: true });

    // 11. Dynamic Window Resize
    const handleResize = () => {
      if (!container || isDisposed) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      updateCamera(newWidth, newHeight);
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 12. Visibility Change Detection
    let isTabVisible = !document.hidden;
    const handleVisibility = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 13. Instant Settings Subscription & Real-Time Sync
    const unsubscribeSettings = globeSettingsService.subscribe((newSettings) => {
      settingsRef.current = newSettings;
      const palette = resolvePalette(newSettings);
      currentPalette = palette;

      rimMat.uniforms.glowColor.value.set(palette.rim);
      rimMat.uniforms.bias.value = 1.15 * newSettings.atmosphericGlow;
      rimMat.uniforms.intensity.value = newSettings.lightIntensity;

      coreMat.opacity = 0.96 * newSettings.ambientBrightness;

      if (landPointsMat) {
        landPointsMat.size = 0.046 * newSettings.surfaceIllumination;
        landPointsMat.opacity =
          0.94 * newSettings.lightIntensity * newSettings.surfaceIllumination;
      }

      orbitLines.forEach((l) => {
        (l.material as THREE.LineBasicMaterial).color.set(palette.orbit);
        (l.material as THREE.LineBasicMaterial).opacity =
          0.46 * newSettings.orbitalLightIntensity * newSettings.lightIntensity;
      });

      arcLines.forEach((l) => {
        (l.material as THREE.LineBasicMaterial).color.set(palette.secondary);
        (l.material as THREE.LineBasicMaterial).opacity =
          0.32 * newSettings.orbitalLightIntensity;
      });

      bloomNodes.forEach((node) => {
        node.flareSprite.material.color.set(palette.nodeFlare);
        node.flareSprite.material.opacity =
          0.95 * newSettings.orbitalLightIntensity * newSettings.lightIntensity;
      });

      reflectionMat.opacity =
        0.72 * newSettings.lightIntensity * newSettings.atmosphericGlow;
      const newRefTex = createV3FloorReflectionTexture(palette.floor);
      reflectionMat.map = newRefTex;
      reflectionTexture.dispose();
      reflectionTexture = newRefTex;

      dustMat.opacity = 0.38 * newSettings.atmosphericGlow;
    });

    // 14. Animation Loop
    const clock = new THREE.Clock();
    const rotationSpeed = (2 * Math.PI) / 180;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const delta = clock.getDelta();

      if (!reducedMotionRef.current) {
        const speedMult = isSearchingRef.current ? 3.6 : 1.0;

        globeGroup.rotation.y += rotationSpeed * delta * speedMult;
        globeGroup.rotation.x += (targetTiltX + 0.10 - globeGroup.rotation.x) * 0.05;
        globeGroup.rotation.z += (-targetTiltY * 0.25 - globeGroup.rotation.z) * 0.05;

        dustParticles.rotation.y += rotationSpeed * 0.35 * delta;

        // Traverse holographic intercontinental pulses
        connectionArcs.forEach((arc) => {
          arc.pulseProgress = (arc.pulseProgress + arc.pulseSpeed * delta * speedMult) % 1.0;
          const pos = arc.curve.getPoint(arc.pulseProgress);
          arc.pulseMesh.position.copy(pos);
        });

        // Orbit satellite nodes
        bloomNodes.forEach((node) => {
          node.progress =
            (node.progress + node.speed * delta * (isSearchingRef.current ? 2.8 : 1.0)) % 1.0;
          const cfg = orbitConfigs[node.orbitIdx];
          const pt2D = cfg.curve.getPoint(node.progress);

          const pos = new THREE.Vector3(pt2D.x, 0, pt2D.y);
          pos.applyEuler(new THREE.Euler(cfg.rotX, cfg.rotY, cfg.rotZ));
          node.group.position.copy(pos);

          const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 3.5 + node.orbitIdx * 1.5) * 0.12;
          node.flareSprite.scale.set(0.48 * pulse, 0.48 * pulse, 1.0);
        });

        const rimUniforms = rimMat.uniforms;
        if (isSearchingRef.current) {
          rimUniforms.searchBoost.value = THREE.MathUtils.lerp(
            rimUniforms.searchBoost.value,
            1.0,
            0.1
          );
          reflectionMat.opacity = THREE.MathUtils.lerp(
            reflectionMat.opacity,
            0.92 * settingsRef.current.lightIntensity,
            0.1
          );
        } else {
          rimUniforms.searchBoost.value = THREE.MathUtils.lerp(
            rimUniforms.searchBoost.value,
            0.0,
            0.05
          );
          reflectionMat.opacity = THREE.MathUtils.lerp(
            reflectionMat.opacity,
            0.72 * settingsRef.current.lightIntensity * settingsRef.current.atmosphericGlow,
            0.05
          );
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 15. Disposal & Memory Leak Prevention
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      unsubscribeSettings();

      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      container.removeEventListener('mousedown', handlePointerDown);
      container.removeEventListener('touchstart', handlePointerDown);

      circleTexture.dispose();
      flareTexture.dispose();
      reflectionTexture.dispose();

      coreGeo.dispose();
      coreMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();

      connectionArcs.forEach((arc) => {
        arc.pulseMesh.geometry.dispose();
        (arc.pulseMesh.material as THREE.Material).dispose();
      });

      arcLines.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });

      orbitLines.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });

      bloomNodes.forEach((node) => {
        node.flareSprite.material.dispose();
      });

      reflectionGeo.dispose();
      reflectionMat.dispose();

      if (landPointsGeo) (landPointsGeo as THREE.BufferGeometry).dispose();
      if (landPointsMat) (landPointsMat as THREE.Material).dispose();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing select-none ${className}`}
      aria-label="3D Holographic Particle Earth Globe"
    />
  );
};
