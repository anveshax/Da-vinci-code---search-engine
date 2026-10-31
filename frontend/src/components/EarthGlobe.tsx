import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audioService } from '../services/audioService';
import {
  globeSettingsService,
  GlobeSettings,
  resolvePalette,
} from '../services/globeSettings';

interface EarthGlobeProps {
  isSearching?: boolean;
  reducedMotion?: boolean;
  onNodePulse?: (pulseFn: () => void) => void;
  className?: string;
}

export const EarthGlobe: React.FC<EarthGlobeProps> = ({
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

    // 1. Scene, Camera, WebGL Renderer
    const scene = new THREE.Scene();
    scene.background = null; // Transparent canvas over #000000 HTML background

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0); // Transparent canvas
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Root Group for all rotating globe elements
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const sphereRadius = 2.45;

    // Initial orientation: Facing the Americas and the Atlantic Ocean
    globeGroup.rotation.y = -Math.PI * 0.42;
    globeGroup.rotation.x = 0.12;

    let currentPalette = resolvePalette(settingsRef.current);

    // 2. Dark Opaque Core (Prevents see-through clutter from back of Earth)
    const coreGeo = new THREE.SphereGeometry(sphereRadius * 0.985, 36, 36);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x020408,
      transparent: true,
      opacity: 0.94 * settingsRef.current.ambientBrightness,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // 3. Upper-Left Fresnel Rim Glow Shell
    const rimGeo = new THREE.SphereGeometry(sphereRadius * 1.015, 48, 48);
    const rimMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color(currentPalette.rim) },
        coreColor: { value: new THREE.Color(0xffffff) },
        bias: { value: 1.0 * settingsRef.current.atmosphericGlow },
        power: { value: 3.2 },
        lightPos: { value: new THREE.Vector3(-0.6, 0.7, 0.35).normalize() },
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
          
          // Fresnel rim calculation
          float fresnel = 1.0 - max(0.0, dot(normal, viewDir));
          fresnel = pow(fresnel, power) * bias;
          
          // Strongest at upper-left corner
          float dirIntensity = max(0.0, dot(normal, lightPos));
          float upperLeftRim = fresnel * (0.35 + 0.85 * dirIntensity);
          
          vec3 col = mix(glowColor, coreColor, fresnel * 0.6);
          float alpha = clamp(upperLeftRim * (0.65 + searchBoost * 0.45) * intensity, 0.0, 0.95);
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
      const iceBlue = new THREE.Color(currentPalette.secondary);
      const deepIce = new THREE.Color(0x7094d4);

      let targetIdx = 0;
      for (let i = 0; i < totalPoints; i += step) {
        const x = coords[i * 3];
        const y = coords[i * 3 + 1];
        const z = coords[i * 3 + 2];

        // Scale to sphere radius
        positions[targetIdx * 3] = x * sphereRadius;
        positions[targetIdx * 3 + 1] = y * sphereRadius;
        positions[targetIdx * 3 + 2] = z * sphereRadius;

        // Color palette: predominantly crisp white with subtle icy blue
        const rand = Math.random();
        let c: THREE.Color;
        if (rand < 0.65) {
          c = white.clone().lerp(iceBlue, Math.random() * 0.25);
        } else if (rand < 0.92) {
          c = iceBlue.clone().lerp(white, Math.random() * 0.4);
        } else {
          c = deepIce;
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
        size: 0.042 * settingsRef.current.surfaceIllumination,
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
        if (!res.ok) throw new Error('Could not load land points data');
        return res.json();
      })
      .then((coords: number[]) => {
        setupLandPoints(coords);
      })
      .catch((err) => {
        console.warn('Fallback: Generating procedural Fibonacci sphere points', err);
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

    // 5. Fine Dust Particle Halo Outside the Limb
    const dustCount = 380;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = sphereRadius * (1.04 + Math.random() * 0.18);

      dustPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      dustPositions[i * 3 + 2] = r * Math.cos(phi);

      dustColors[i * 3] = 0.7;
      dustColors[i * 3 + 1] = 0.85;
      dustColors[i * 3 + 2] = 1.0;
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

    const dustMat = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.35 * settingsRef.current.atmosphericGlow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // 6. 3 Tilted Elliptical Orbit Lines & 5 Glowing Bloom Nodes
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
      { a: 3.35, b: 3.10, rotX: 0.72, rotY: 0.32, rotZ: -0.25, curve: new THREE.EllipseCurve(0, 0, 3.35, 3.10, 0, 2 * Math.PI, false, 0) },
      { a: 3.65, b: 3.25, rotX: -0.68, rotY: -0.45, rotZ: 0.40, curve: new THREE.EllipseCurve(0, 0, 3.65, 3.25, 0, 2 * Math.PI, false, 0) },
      { a: 3.90, b: 3.45, rotX: 0.28, rotY: 0.82, rotZ: 0.65, curve: new THREE.EllipseCurve(0, 0, 3.90, 3.45, 0, 2 * Math.PI, false, 0) },
    ];

    const orbitLines: THREE.Line[] = [];

    orbitConfigs.forEach((cfg) => {
      const points2D = cfg.curve.getPoints(120);
      const points3D = points2D.map((p) => new THREE.Vector3(p.x, 0, p.y));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points3D);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(currentPalette.orbit),
        transparent: true,
        opacity: 0.48 * settingsRef.current.orbitalLightIntensity * settingsRef.current.lightIntensity,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      orbitGroup.add(line);
      orbitLines.push(line);
    });

    // 5 Glowing White Bloom Nodes traveling along the orbits
    interface BloomNode {
      mesh: THREE.Group;
      haloMesh: THREE.Mesh;
      orbitIdx: number;
      progress: number;
      speed: number;
      baseScale: number;
    }

    const bloomNodes: BloomNode[] = [];
    const nodeConfigs = [
      { orbitIdx: 0, initialT: 0.05, speed: 0.08 },
      { orbitIdx: 0, initialT: 0.58, speed: 0.08 },
      { orbitIdx: 1, initialT: 0.22, speed: 0.065 },
      { orbitIdx: 1, initialT: 0.78, speed: 0.065 },
      { orbitIdx: 2, initialT: 0.40, speed: 0.05 },
    ];

    nodeConfigs.forEach((nc) => {
      const nodeGroup = new THREE.Group();

      // Sharp bright white inner core
      const innerGeo = new THREE.SphereGeometry(0.048, 16, 16);
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      nodeGroup.add(innerMesh);

      // Soft icy-blue bloom halo
      const haloGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(currentPalette.nodeFlare),
        transparent: true,
        opacity: 0.65 * settingsRef.current.orbitalLightIntensity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      nodeGroup.add(haloMesh);

      orbitGroup.add(nodeGroup);
      bloomNodes.push({
        mesh: nodeGroup,
        haloMesh,
        orbitIdx: nc.orbitIdx,
        progress: nc.initialT,
        speed: nc.speed,
        baseScale: 1.0,
      });
    });

    // 7. Ground Reflection and Mist Fading to Black Over ~120px
    const reflectionCanvas = document.createElement('canvas');
    reflectionCanvas.width = 256;
    reflectionCanvas.height = 256;
    const rCtx = reflectionCanvas.getContext('2d');
    if (rCtx) {
      const grad = rCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(160, 196, 255, 0.22)');
      grad.addColorStop(0.25, 'rgba(112, 148, 212, 0.12)');
      grad.addColorStop(0.65, 'rgba(5, 8, 16, 0.03)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      rCtx.fillStyle = grad;
      rCtx.fillRect(0, 0, 256, 256);
    }

    const reflectionTexture = new THREE.CanvasTexture(reflectionCanvas);
    const reflectionGeo = new THREE.PlaneGeometry(sphereRadius * 3.6, sphereRadius * 3.6);
    const reflectionMat = new THREE.MeshBasicMaterial({
      map: reflectionTexture,
      transparent: true,
      opacity: 0.75 * settingsRef.current.lightIntensity * settingsRef.current.atmosphericGlow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const reflectionPlane = new THREE.Mesh(reflectionGeo, reflectionMat);
    reflectionPlane.rotation.x = -Math.PI / 2;
    reflectionPlane.position.y = -sphereRadius - 0.52;
    scene.add(reflectionPlane);

    // 8. Pointer Tilt Tracking
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

      targetTiltY = x * 0.55;
      targetTiltX = y * 0.45;

      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
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

    // 9. Window Resize
    const handleResize = () => {
      if (!container || isDisposed) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 10. Visibility Change
    let isTabVisible = !document.hidden;
    const handleVisibility = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 11. Settings Subscription
    const unsubscribeSettings = globeSettingsService.subscribe((newSettings) => {
      settingsRef.current = newSettings;
      const palette = resolvePalette(newSettings);
      currentPalette = palette;

      rimMat.uniforms.glowColor.value.set(palette.rim);
      rimMat.uniforms.bias.value = 1.0 * newSettings.atmosphericGlow;
      rimMat.uniforms.intensity.value = newSettings.lightIntensity;

      coreMat.opacity = 0.94 * newSettings.ambientBrightness;

      if (landPointsMat) {
        landPointsMat.size = 0.042 * newSettings.surfaceIllumination;
        landPointsMat.opacity =
          0.92 * newSettings.lightIntensity * newSettings.surfaceIllumination;
      }

      orbitLines.forEach((l) => {
        (l.material as THREE.LineBasicMaterial).color.set(palette.orbit);
        (l.material as THREE.LineBasicMaterial).opacity =
          0.48 * newSettings.orbitalLightIntensity * newSettings.lightIntensity;
      });

      bloomNodes.forEach((node) => {
        (node.haloMesh.material as THREE.MeshBasicMaterial).color.set(palette.nodeFlare);
        (node.haloMesh.material as THREE.MeshBasicMaterial).opacity =
          0.65 * newSettings.orbitalLightIntensity;
      });

      reflectionMat.opacity =
        0.75 * newSettings.lightIntensity * newSettings.atmosphericGlow;

      dustMat.opacity = 0.35 * newSettings.atmosphericGlow;
    });

    // 12. Animation Loop
    const clock = new THREE.Clock();
    const rotationSpeed = (2 * Math.PI) / 180;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const delta = clock.getDelta();

      if (!reducedMotionRef.current) {
        const speedMult = isSearchingRef.current ? 3.8 : 1.0;

        // Continuous Earth rotation
        globeGroup.rotation.y += rotationSpeed * delta * speedMult;

        // Pointer damping tilt
        globeGroup.rotation.x += (targetTiltX + 0.12 - globeGroup.rotation.x) * 0.05;
        globeGroup.rotation.z += (-targetTiltY * 0.3 - globeGroup.rotation.z) * 0.05;

        // Dust drift
        dustParticles.rotation.y += rotationSpeed * 0.4 * delta;

        // Update 5 Orbit Bloom Nodes along their 3D elliptical paths
        bloomNodes.forEach((node) => {
          node.progress = (node.progress + node.speed * delta * (isSearchingRef.current ? 3.0 : 1.0)) % 1.0;
          const cfg = orbitConfigs[node.orbitIdx];
          const pt2D = cfg.curve.getPoint(node.progress);

          const pos = new THREE.Vector3(pt2D.x, 0, pt2D.y);
          pos.applyEuler(new THREE.Euler(cfg.rotX, cfg.rotY, cfg.rotZ));
          node.mesh.position.copy(pos);

          const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 4 + node.orbitIdx) * 0.15;
          node.mesh.scale.set(pulse, pulse, pulse);
        });

        // Search state: intensify rim glow and reflection pulse
        const rimUniforms = rimMat.uniforms;
        if (isSearchingRef.current) {
          rimUniforms.searchBoost.value = THREE.MathUtils.lerp(rimUniforms.searchBoost.value, 1.0, 0.1);
          reflectionMat.opacity = THREE.MathUtils.lerp(reflectionMat.opacity, 0.95, 0.1);
        } else {
          rimUniforms.searchBoost.value = THREE.MathUtils.lerp(rimUniforms.searchBoost.value, 0.0, 0.05);
          reflectionMat.opacity = THREE.MathUtils.lerp(
            reflectionMat.opacity,
            0.70 * settingsRef.current.lightIntensity * settingsRef.current.atmosphericGlow,
            0.05
          );
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 13. Cleanup
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
        (node.haloMesh.material as THREE.Material).dispose();
      });
      reflectionGeo.dispose();
      reflectionMat.dispose();
      reflectionTexture.dispose();
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
      aria-label="3D Dot-Matrix Earth Globe"
    />
  );
};
