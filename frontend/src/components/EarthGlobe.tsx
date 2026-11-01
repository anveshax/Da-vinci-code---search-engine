import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { audioService } from '../services/audioService';
import {
  globeSettingsService,
  GlobeSettings,
  GlobeStyle,
  resolvePalette,
} from '../services/globeSettings';
import { EarthGlobeV3 } from './EarthGlobeV3';
import { EarthGlobeV4 } from './EarthGlobeV4';

interface EarthGlobeProps {
  isSearching?: boolean;
  reducedMotion?: boolean;
  onNodePulse?: (pulseFn: () => void) => void;
  className?: string;
}

// Procedural soft-circular particle texture for realistic mode point cloud
function createCircleParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.25, 'rgba(230, 240, 255, 0.9)');
    grad.addColorStop(0.55, 'rgba(160, 200, 255, 0.35)');
    grad.addColorStop(0.85, 'rgba(120, 160, 255, 0.08)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Procedural starburst cross-flare texture for realistic mode satellite nodes
function createFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.15, 'rgba(220, 240, 255, 0.85)');
    grad.addColorStop(0.4, 'rgba(140, 190, 255, 0.25)');
    grad.addColorStop(0.7, 'rgba(80, 140, 255, 0.05)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const hGrad = ctx.createLinearGradient(0, 64, 128, 64);
    hGrad.addColorStop(0.0, 'rgba(180, 220, 255, 0.0)');
    hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    hGrad.addColorStop(1.0, 'rgba(180, 220, 255, 0.0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 62, 128, 4);

    const vGrad = ctx.createLinearGradient(64, 0, 64, 128);
    vGrad.addColorStop(0.0, 'rgba(180, 220, 255, 0.0)');
    vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    vGrad.addColorStop(1.0, 'rgba(180, 220, 255, 0.0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(62, 0, 4, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Procedural vertical streak floor reflection texture (Realistic Mode)
function createFloorReflectionTexture(floorColorHex: string): THREE.CanvasTexture {
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
    grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.36)`);
    grad.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.20)`);
    grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.07)`);
    grad.addColorStop(0.75, `rgba(5, 8, 18, 0.02)`);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.save();
    ctx.translate(256, 256);
    ctx.scale(1.4, 0.65);
    ctx.translate(-256, -256);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.restore();

    const ribGrad = ctx.createLinearGradient(0, 0, 512, 0);
    ribGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
    ribGrad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.0)`);
    ribGrad.addColorStop(0.5, `rgba(255, 255, 255, 0.14)`);
    ribGrad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, 0.0)`);
    ribGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = ribGrad;
    ctx.fillRect(160, 210, 192, 92);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Procedural radial floor reflection texture (Classic Mode)
function createClassicReflectionTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(160, 196, 255, 0.22)');
    grad.addColorStop(0.25, 'rgba(112, 148, 212, 0.12)');
    grad.addColorStop(0.65, 'rgba(5, 8, 16, 0.03)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export const EarthGlobe: React.FC<EarthGlobeProps> = ({
  isSearching = false,
  reducedMotion = false,
  onNodePulse,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isSearchingRef = useRef(isSearching);
  const reducedMotionRef = useRef(reducedMotion);
  const settingsRef = useRef<GlobeSettings>(globeSettingsService.getSettings());

  const [activeStyle, setActiveStyle] = useState<GlobeStyle>(() => {
    return globeSettingsService.getSettings().globeStyle || 'realistic';
  });

  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  // Sync activeStyle with globeSettingsService
  useEffect(() => {
    const unsub = globeSettingsService.subscribe((settings) => {
      if (settings.globeStyle && settings.globeStyle !== activeStyle) {
        setActiveStyle(settings.globeStyle);
      }
    });
    return unsub;
  }, [activeStyle]);

  useEffect(() => {
    const container = mountRef.current;
    const isDelegated =
      activeStyle === 'holographic' ||
      activeStyle === 'v3' ||
      activeStyle === 'cinematic' ||
      activeStyle === 'v4';
    if (!container || isDelegated) return;

    let isDisposed = false;
    let animationFrameId: number;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const isRealistic = activeStyle !== 'classic' && activeStyle !== 'v1';

    // 1. Scene, Camera, WebGL Renderer
    const scene = new THREE.Scene();
    scene.background = null;

    const sphereRadius = isRealistic ? 2.40 : 2.45;
    const fov = isRealistic ? 38 : 40;
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1000);

    const updateCamera = (w: number, h: number) => {
      if (w >= 1024) {
        // Desktop / Laptop: strict preservation of original desktop framing
        if (isRealistic) {
          const targetPixelDiameter = Math.min(500, Math.min(w, h) * 0.78);
          const halfFovRad = (fov / 2) * (Math.PI / 180);
          const zDist = (sphereRadius / Math.tan(halfFovRad)) * (h / targetPixelDiameter);
          camera.position.set(0, 0, Math.max(7.2, Math.min(10.5, zDist)));
        } else {
          camera.position.set(0, 0, 7.8);
        }
      } else {
        // Mobile & Tablet: responsive viewport-aware camera calculation
        // Keeps sphere scaled comfortably (~50% width on phones, max 220px) without covering search bar
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

    globeGroup.rotation.y = -Math.PI * 0.42;
    globeGroup.rotation.x = isRealistic ? 0.10 : 0.12;

    const circleTexture = isRealistic ? createCircleParticleTexture() : null;
    const flareTexture = isRealistic ? createFlareTexture() : null;
    let currentPalette = resolvePalette(settingsRef.current);
    let reflectionTexture = isRealistic
      ? createFloorReflectionTexture(currentPalette.floor)
      : createClassicReflectionTexture();

    // 2. Dark Opaque Core Sphere
    const coreGeo = new THREE.SphereGeometry(sphereRadius * 0.988, 48, 48);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x020409,
      transparent: true,
      opacity: 0.96 * settingsRef.current.ambientBrightness,
      depthWrite: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // 3. Atmospheric Rim Lighting Shader Shell
    const rimGeo = new THREE.SphereGeometry(sphereRadius * 1.018, 54, 54);
    const rimMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color(currentPalette.rim) },
        coreColor: { value: new THREE.Color(0xffffff) },
        bias: { value: (isRealistic ? 1.15 : 1.0) * settingsRef.current.atmosphericGlow },
        power: { value: isRealistic ? 3.1 : 3.2 },
        lightPos: {
          value: new THREE.Vector3(
            isRealistic ? -0.55 : -0.6,
            isRealistic ? 0.72 : 0.7,
            isRealistic ? 0.42 : 0.35
          ).normalize(),
        },
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
          float upperRim = fresnel * (0.32 + 0.88 * dirIntensity);
          vec3 col = mix(glowColor, coreColor, fresnel * 0.55);
          float alpha = clamp(upperRim * (0.68 + searchBoost * 0.42) * intensity, 0.0, 0.96);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    scene.add(rimMesh);

    // 4. Dot-Matrix Land Points Cloud
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

        const rad = sphereRadius * (1.0 + (isRealistic ? Math.random() * 0.006 : 0));
        positions[targetIdx * 3] = x * rad;
        positions[targetIdx * 3 + 1] = y * rad;
        positions[targetIdx * 3 + 2] = z * rad;

        const rand = Math.random();
        let c: THREE.Color;
        if (rand < 0.62) {
          c = white.clone().lerp(accent, Math.random() * 0.35);
        } else if (rand < 0.90) {
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
        size: (isRealistic ? 0.046 : 0.042) * settingsRef.current.surfaceIllumination,
        map: circleTexture || undefined,
        vertexColors: true,
        transparent: true,
        opacity: 0.92 * settingsRef.current.lightIntensity * settingsRef.current.surfaceIllumination,
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

    // 5. Atmospheric Dust Particle Halo
    const dustCount = isRealistic ? 360 : 380;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustColor = new THREE.Color(currentPalette.rim);

    for (let i = 0; i < dustCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = sphereRadius * (1.04 + Math.random() * (isRealistic ? 0.22 : 0.18));

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
      size: isRealistic ? 0.032 : 0.028,
      map: circleTexture || undefined,
      vertexColors: true,
      transparent: true,
      opacity: (isRealistic ? 0.38 : 0.35) * settingsRef.current.atmosphericGlow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // 6. Delicate 3D Elliptical Orbit Lines
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

    const orbitConfigs: OrbitDef[] = isRealistic
      ? [
          { a: 3.32, b: 3.06, rotX: 0.74, rotY: 0.30, rotZ: -0.22, curve: new THREE.EllipseCurve(0, 0, 3.32, 3.06, 0, 2 * Math.PI, false, 0) },
          { a: 3.65, b: 3.25, rotX: -0.65, rotY: -0.42, rotZ: 0.36, curve: new THREE.EllipseCurve(0, 0, 3.65, 3.25, 0, 2 * Math.PI, false, 0) },
          { a: 3.90, b: 3.45, rotX: 0.28, rotY: 0.80, rotZ: 0.58, curve: new THREE.EllipseCurve(0, 0, 3.90, 3.45, 0, 2 * Math.PI, false, 0) },
        ]
      : [
          { a: 3.35, b: 3.10, rotX: 0.72, rotY: 0.32, rotZ: -0.25, curve: new THREE.EllipseCurve(0, 0, 3.35, 3.10, 0, 2 * Math.PI, false, 0) },
          { a: 3.65, b: 3.25, rotX: -0.68, rotY: -0.45, rotZ: 0.40, curve: new THREE.EllipseCurve(0, 0, 3.65, 3.25, 0, 2 * Math.PI, false, 0) },
          { a: 3.90, b: 3.45, rotX: 0.28, rotY: 0.82, rotZ: 0.65, curve: new THREE.EllipseCurve(0, 0, 3.90, 3.45, 0, 2 * Math.PI, false, 0) },
        ];

    const orbitLines: THREE.Line[] = [];

    orbitConfigs.forEach((cfg) => {
      const points2D = cfg.curve.getPoints(140);
      const points3D = points2D.map((p) => new THREE.Vector3(p.x, 0, p.y));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points3D);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(currentPalette.orbit),
        transparent: true,
        opacity: (isRealistic ? 0.46 : 0.48) * settingsRef.current.orbitalLightIntensity * settingsRef.current.lightIntensity,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      orbitGroup.add(line);
      orbitLines.push(line);
    });

    // 7. Glowing Orbital Nodes (Starburst Flare Sprites for Realistic, 3D Halo Meshes for Classic)
    interface BloomNode {
      group: THREE.Group;
      flareSprite?: THREE.Sprite;
      haloMesh?: THREE.Mesh;
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
      const innerGeo = new THREE.SphereGeometry(isRealistic ? 0.042 : 0.048, 16, 16);
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      nodeGroup.add(innerMesh);

      let flareSprite: THREE.Sprite | undefined;
      let haloMesh: THREE.Mesh | undefined;

      if (isRealistic && flareTexture) {
        // Realistic Mode: Starburst cross-flare sprite
        const flareMat = new THREE.SpriteMaterial({
          map: flareTexture,
          color: new THREE.Color(currentPalette.nodeFlare),
          transparent: true,
          opacity: 0.95 * settingsRef.current.orbitalLightIntensity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        flareSprite = new THREE.Sprite(flareMat);
        flareSprite.scale.set(0.48, 0.48, 1.0);
        nodeGroup.add(flareSprite);
      } else {
        // Classic Mode: 3D Sphere halo mesh
        const haloGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(currentPalette.nodeFlare),
          transparent: true,
          opacity: 0.65 * settingsRef.current.orbitalLightIntensity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        haloMesh = new THREE.Mesh(haloGeo, haloMat);
        nodeGroup.add(haloMesh);
      }

      orbitGroup.add(nodeGroup);
      bloomNodes.push({
        group: nodeGroup,
        flareSprite,
        haloMesh,
        orbitIdx: nc.orbitIdx,
        progress: nc.initialT,
        speed: nc.speed,
      });
    });

    // 8. Ground Reflection Plane
    const reflectionGeo = new THREE.PlaneGeometry(
      sphereRadius * (isRealistic ? 4.2 : 3.6),
      sphereRadius * (isRealistic ? 2.8 : 3.6)
    );
    const reflectionMat = new THREE.MeshBasicMaterial({
      map: reflectionTexture,
      transparent: true,
      opacity: (isRealistic ? 0.72 : 0.75) * settingsRef.current.lightIntensity * settingsRef.current.atmosphericGlow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const reflectionPlane = new THREE.Mesh(reflectionGeo, reflectionMat);
    reflectionPlane.rotation.x = -Math.PI / 2;
    reflectionPlane.position.y = -sphereRadius - (isRealistic ? 0.48 : 0.52);
    scene.add(reflectionPlane);

    // 9. Interactive Pointer Tilt
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

      targetTiltY = x * (isRealistic ? 0.48 : 0.55);
      targetTiltX = y * (isRealistic ? 0.38 : 0.45);

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

    // 10. Dynamic Window Resize
    const handleResize = () => {
      if (!container || isDisposed) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      updateCamera(newWidth, newHeight);
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 11. Visibility Change Detection
    let isTabVisible = !document.hidden;
    const handleVisibility = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 12. Instant Settings Subscription & Real-Time Sync
    const unsubscribeSettings = globeSettingsService.subscribe((newSettings) => {
      settingsRef.current = newSettings;
      const palette = resolvePalette(newSettings);
      currentPalette = palette;

      rimMat.uniforms.glowColor.value.set(palette.rim);
      rimMat.uniforms.bias.value = (isRealistic ? 1.15 : 1.0) * newSettings.atmosphericGlow;
      rimMat.uniforms.intensity.value = newSettings.lightIntensity;

      coreMat.opacity = (isRealistic ? 0.96 : 0.94) * newSettings.ambientBrightness;

      if (landPointsMat) {
        landPointsMat.size = (isRealistic ? 0.046 : 0.042) * newSettings.surfaceIllumination;
        landPointsMat.opacity =
          0.92 * newSettings.lightIntensity * newSettings.surfaceIllumination;
      }

      orbitLines.forEach((l) => {
        (l.material as THREE.LineBasicMaterial).color.set(palette.orbit);
        (l.material as THREE.LineBasicMaterial).opacity =
          (isRealistic ? 0.46 : 0.48) * newSettings.orbitalLightIntensity * newSettings.lightIntensity;
      });

      bloomNodes.forEach((node) => {
        if (node.flareSprite) {
          node.flareSprite.material.color.set(palette.nodeFlare);
          node.flareSprite.material.opacity =
            0.95 * newSettings.orbitalLightIntensity * newSettings.lightIntensity;
        }
        if (node.haloMesh) {
          (node.haloMesh.material as THREE.MeshBasicMaterial).color.set(palette.nodeFlare);
          (node.haloMesh.material as THREE.MeshBasicMaterial).opacity =
            0.65 * newSettings.orbitalLightIntensity;
        }
      });

      reflectionMat.opacity =
        (isRealistic ? 0.72 : 0.75) * newSettings.lightIntensity * newSettings.atmosphericGlow;
      if (isRealistic) {
        const newRefTex = createFloorReflectionTexture(palette.floor);
        reflectionMat.map = newRefTex;
        reflectionTexture.dispose();
        reflectionTexture = newRefTex;
      }

      dustMat.opacity = (isRealistic ? 0.38 : 0.35) * newSettings.atmosphericGlow;
    });

    // 13. Animation Loop
    const clock = new THREE.Clock();
    const rotationSpeed = (2 * Math.PI) / 180;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const delta = clock.getDelta();

      if (!reducedMotionRef.current) {
        const speedMult = isSearchingRef.current ? 3.6 : 1.0;

        globeGroup.rotation.y += rotationSpeed * delta * speedMult;
        globeGroup.rotation.x += (targetTiltX + (isRealistic ? 0.10 : 0.12) - globeGroup.rotation.x) * 0.05;
        globeGroup.rotation.z += (-targetTiltY * (isRealistic ? 0.25 : 0.3) - globeGroup.rotation.z) * 0.05;

        dustParticles.rotation.y += rotationSpeed * 0.35 * delta;

        bloomNodes.forEach((node) => {
          node.progress =
            (node.progress + node.speed * delta * (isSearchingRef.current ? 2.8 : 1.0)) % 1.0;
          const cfg = orbitConfigs[node.orbitIdx];
          const pt2D = cfg.curve.getPoint(node.progress);

          const pos = new THREE.Vector3(pt2D.x, 0, pt2D.y);
          pos.applyEuler(new THREE.Euler(cfg.rotX, cfg.rotY, cfg.rotZ));
          node.group.position.copy(pos);

          if (node.flareSprite) {
            const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 3.5 + node.orbitIdx * 1.5) * 0.12;
            node.flareSprite.scale.set(0.48 * pulse, 0.48 * pulse, 1.0);
          } else {
            const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 4 + node.orbitIdx) * 0.15;
            node.group.scale.set(pulse, pulse, pulse);
          }
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
            (isRealistic ? 0.72 : 0.70) * settingsRef.current.lightIntensity * settingsRef.current.atmosphericGlow,
            0.05
          );
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 14. Cleanup
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

      if (circleTexture) circleTexture.dispose();
      if (flareTexture) flareTexture.dispose();
      reflectionTexture.dispose();

      coreGeo.dispose();
      coreMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();

      orbitLines.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });

      bloomNodes.forEach((node) => {
        if (node.flareSprite) node.flareSprite.material.dispose();
        if (node.haloMesh) (node.haloMesh.material as THREE.Material).dispose();
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
  }, [activeStyle]);

  if (activeStyle === 'holographic' || activeStyle === 'v3') {
    return (
      <EarthGlobeV3
        isSearching={isSearching}
        reducedMotion={reducedMotion}
        onNodePulse={onNodePulse}
        className={className}
      />
    );
  }

  if (activeStyle === 'cinematic' || activeStyle === 'v4') {
    return (
      <EarthGlobeV4
        isSearching={isSearching}
        reducedMotion={reducedMotion}
        onNodePulse={onNodePulse}
        className={className}
      />
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing select-none ${className}`}
      aria-label="3D Dot-Matrix Earth Globe"
    />
  );
};
