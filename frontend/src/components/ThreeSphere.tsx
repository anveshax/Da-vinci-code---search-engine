import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeSphereProps {
  isSearching?: boolean;
  reducedMotion?: boolean;
}

export const ThreeSphere: React.FC<ThreeSphereProps> = ({
  isSearching = false,
  reducedMotion = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isSearchingRef = useRef(isSearching);
  const reducedMotionRef = useRef(reducedMotion);

  // Keep refs in sync for requestAnimationFrame loop
  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 420;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 7.5;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Laptop/mobile GPU optimization
    container.appendChild(renderer.domElement);

    // Root Group for all sphere elements
    const sphereGroup = new THREE.Group();
    scene.add(sphereGroup);

    // 2. Glowing Particle Cloud
    const particleCount = reducedMotionRef.current ? 400 : 750;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const cyanColor = new THREE.Color('#06B6D4');
    const violetColor = new THREE.Color('#8B5CF6');
    const sphereRadius = 2.4;

    for (let i = 0; i < particleCount; i++) {
      // Golden spiral distribution for uniform sphere surface
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;

      // Slight radial displacement for depth
      const r = sphereRadius + (Math.random() - 0.5) * 0.25;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      // Blend between cyan and violet
      const mixedColor = cyanColor.clone().lerp(violetColor, Math.random());
      particleColors[i * 3] = mixedColor.r;
      particleColors[i * 3 + 1] = mixedColor.g;
      particleColors[i * 3 + 2] = mixedColor.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    sphereGroup.add(particles);

    // 3. Fine Wireframe Inner Core
    const wireframeGeometry = new THREE.IcosahedronGeometry(sphereRadius * 0.98, 2);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x06B6D4,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    sphereGroup.add(wireframeMesh);

    // 4. Orbital Rings (Tilted rings with counter-rotation)
    const createRing = (radius: number, tiltX: number, tiltY: number, color: number) => {
      const ringGeo = new THREE.TorusGeometry(radius, 0.015, 8, 80);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = tiltX;
      ring.rotation.y = tiltY;
      return ring;
    };

    const ring1 = createRing(sphereRadius * 1.35, Math.PI / 3, Math.PI / 6, 0x06B6D4);
    const ring2 = createRing(sphereRadius * 1.5, -Math.PI / 4, Math.PI / 4, 0x8B5CF6);
    sphereGroup.add(ring1);
    sphereGroup.add(ring2);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x06B6D4, 2, 20);
    cyanLight.position.set(4, 3, 5);
    scene.add(cyanLight);

    const violetLight = new THREE.PointLight(0x8B5CF6, 2, 20);
    violetLight.position.set(-4, -3, 3);
    scene.add(violetLight);

    // 6. Pointer Tracking (Mouse / Touch tilt)
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const rect = container.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;

      targetRotationY = x * 0.8;
      targetRotationX = y * 0.8;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // 7. Window Resize Listener
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 420;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (!reducedMotionRef.current) {
        const speedMultiplier = isSearchingRef.current ? 4.5 : 1.0;

        // Base idle rotation
        sphereGroup.rotation.y += 0.25 * delta * speedMultiplier;
        sphereGroup.rotation.x += 0.08 * delta * speedMultiplier;

        // Orbital ring counter-rotations
        ring1.rotation.z += 0.35 * delta * speedMultiplier;
        ring2.rotation.z -= 0.45 * delta * speedMultiplier;

        // Pulse scale slightly when searching
        if (isSearchingRef.current) {
          const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 8) * 0.04;
          sphereGroup.scale.set(pulse, pulse, pulse);
          particleMaterial.size = 0.07;
        } else {
          sphereGroup.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
          particleMaterial.size = 0.05;
        }

        // Smooth damping toward mouse pointer target
        sphereGroup.rotation.x += (targetRotationX - sphereGroup.rotation.x) * 0.05;
        sphereGroup.rotation.y += (targetRotationY - sphereGroup.rotation.y) * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('resize', handleResize);

      particleGeometry.dispose();
      particleMaterial.dispose();
      wireframeGeometry.dispose();
      wireframeMaterial.dispose();
      ring1.geometry.dispose();
      (ring1.material as THREE.Material).dispose();
      ring2.geometry.dispose();
      (ring2.material as THREE.Material).dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-[360px] sm:h-[420px] md:h-[460px] flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Codebase Intelligence Sphere"
    />
  );
};
