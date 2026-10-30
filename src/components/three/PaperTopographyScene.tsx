import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Interactive 3D Topographic Field Observatory & Specimen Instrument.
 * Replaces the basic stacked cylinders with a sculpted cartographic relief,
 * iso-elevation contour lines, dual astrolabe meridian gimbals, atmospheric
 * particle field, and 3 interactive specimen modes (Light, Nature, Sound).
 */

export type ObservatorySpecimenKey = 'Light' | 'Nature' | 'Sound';

export interface PaperTopographySceneProps {
  activeSpecimen?: ObservatorySpecimenKey;
  onSelectSpecimen?: (specimen: ObservatorySpecimenKey) => void;
}

interface ObservatoryMeshProps {
  sunAngle: number;
  specimen: ObservatorySpecimenKey;
  isLightTheme: boolean;
  pointerOffset: { x: number; y: number };
  reducedMotion: boolean;
  isVisible: boolean;
}

function sampleElevation(x: number, z: number, specimen: ObservatorySpecimenKey): number {
  const r = Math.sqrt(x * x + z * z);
  const falloff = Math.max(0, 1 - (r / 1.95) ** 2);

  if (specimen === 'Light') {
    const ridge =
      0.38 * Math.cos(x * 1.65 - 0.35) * Math.cos(z * 1.35) +
      0.18 * Math.sin(x * 3.1 + z * 2.2) +
      0.14 * Math.cos(r * 4.2);
    return ridge * falloff - 0.22;
  }

  if (specimen === 'Nature') {
    const cleft =
      0.42 * Math.sin(x * 1.9) * Math.cos(z * 1.7) +
      0.22 * Math.cos((x - z) * 2.8) +
      0.12 * Math.sin(r * 5.0);
    return cleft * falloff - 0.22;
  }

  // Sound: harmonic concentric wave basin
  const wave =
    0.36 * Math.cos(r * 5.2 - 0.4) +
    0.16 * Math.sin(x * 2.4) * Math.sin(z * 2.4);
  return wave * falloff - 0.22;
}

const ObservatoryTerrainAndSpecimen: React.FC<ObservatoryMeshProps> = ({
  sunAngle,
  specimen,
  isLightTheme,
  pointerOffset,
  reducedMotion,
  isVisible,
}) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const focalGroupRef = useRef<THREE.Group>(null);
  const gimbalOuterRef = useRef<THREE.Mesh>(null);
  const gimbalInnerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Build sculpted terrain geometry whenever specimen changes
  const terrainGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(3.3, 3.3, 56, 56);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = sampleElevation(vx, vz, specimen);
      pos.setY(i, vy);
    }
    geom.computeVertexNormals();
    return geom;
  }, [specimen]);

  // Stepped architectural iso-contour rings
  const contourRings = useMemo(() => {
    const levels = [0, 1, 2, 3, 4, 5, 6];
    return levels.map((lvl) => {
      const frac = lvl / 6;
      const radius = 1.48 - frac * 1.02;
      const y = -0.24 + frac * 0.48;
      return { radius, y, isMajor: lvl % 2 === 0 };
    });
  }, []);

  // Atmospheric particle coordinates
  const particlePositions = useMemo(() => {
    const count = 42;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 * 3.7;
      const rad = 0.25 + ((i * 19) % 100) / 100 * 1.35;
      arr[i * 3] = Math.cos(angle) * rad;
      arr[i * 3 + 1] = -0.05 + ((i * 31) % 100) / 100 * 0.95;
      arr[i * 3 + 2] = Math.sin(angle) * rad;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!isVisible) return;
    const t = reducedMotion ? 0 : state.clock.getElapsedTime();

    if (rootGroupRef.current) {
      const targetRotY =
        (sunAngle - 0.5) * 0.85 + pointerOffset.x * 0.42 + Math.sin(t * 0.32) * 0.05;
      const targetRotX =
        0.32 + pointerOffset.y * 0.24 + Math.cos(t * 0.26) * 0.02;
      rootGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        rootGroupRef.current.rotation.y,
        targetRotY,
        0.07
      );
      rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        rootGroupRef.current.rotation.x,
        targetRotX,
        0.07
      );
    }

    if (focalGroupRef.current && !reducedMotion) {
      focalGroupRef.current.position.y = 0.46 + Math.sin(t * 1.4) * 0.03;
      focalGroupRef.current.rotation.y = t * 0.45;
    }

    if (gimbalOuterRef.current && !reducedMotion) {
      gimbalOuterRef.current.rotation.z = Math.sin(t * 0.25) * 0.08;
    }
    if (gimbalInnerRef.current && !reducedMotion) {
      gimbalInnerRef.current.rotation.x = Math.PI / 2.6 + Math.cos(t * 0.3) * 0.06;
    }
    if (particlesRef.current && !reducedMotion) {
      particlesRef.current.rotation.y = t * 0.08;
    }
  });

  const solarAzimuth = sunAngle * Math.PI;
  const sunX = Math.cos(solarAzimuth) * 2.8;
  const sunY = 1.65 + Math.sin(solarAzimuth) * 0.75;
  const sunZ = Math.sin(solarAzimuth) * 2.2 + 0.8;

  const surfaceColor = isLightTheme ? '#ece7dd' : '#121215';
  const wireColor = isLightTheme ? '#8c8275' : '#ff4500';
  const accentColor = isLightTheme ? '#e03c00' : '#ff4500';
  const secondaryRingColor = isLightTheme ? '#4a433b' : '#ffe0e0';
  const basePlateColor = isLightTheme ? '#dcd5c7' : '#09090b';

  return (
    <group ref={rootGroupRef} rotation={[0.32, -0.28, 0]}>
      <ambientLight intensity={isLightTheme ? 1.15 : 0.68} color={isLightTheme ? '#fffaf0' : '#ffe0e0'} />
      <directionalLight
        position={[sunX, sunY + 1.6, sunZ]}
        intensity={isLightTheme ? 1.55 : 2.1}
        color={accentColor}
      />
      <directionalLight
        position={[-2.4, 2.8, -1.8]}
        intensity={isLightTheme ? 0.85 : 0.55}
        color={isLightTheme ? '#ffffff' : '#ffe0e0'}
      />
      <pointLight position={[0, 0.65, 0]} intensity={1.7} distance={3.8} color={accentColor} />

      {/* Precision Base Compass Plinth */}
      <mesh position={[0, -0.34, 0]}>
        <cylinderGeometry args={[1.66, 1.72, 0.08, 64]} />
        <meshStandardMaterial color={basePlateColor} roughness={0.65} metalness={0.25} />
      </mesh>

      {/* Outer Compass Graduation Ring */}
      <mesh position={[0, -0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.56, 1.62, 64]} />
        <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} transparent opacity={0.55} />
      </mesh>

      {/* Sculpted Topographic Relief Surface (Clipped visually inside plinth) */}
      <mesh geometry={terrainGeometry} position={[0, 0.02, 0]}>
        <meshStandardMaterial
          color={surfaceColor}
          roughness={isLightTheme ? 0.58 : 0.42}
          metalness={isLightTheme ? 0.08 : 0.35}
          flatShading
        />
      </mesh>

      {/* Precision Wireframe Topographic Lattice Overlay */}
      <mesh geometry={terrainGeometry} position={[0, 0.024, 0]}>
        <meshBasicMaterial
          color={wireColor}
          wireframe
          transparent
          opacity={isLightTheme ? 0.22 : 0.24}
        />
      </mesh>

      {/* Stepped Iso-Elevation Contour Rings */}
      {contourRings.map((ring, idx) => (
        <mesh
          key={idx}
          position={[0, ring.y, 0]}
          rotation={[Math.PI / 2, 0, idx * 0.25]}
        >
          <torusGeometry args={[ring.radius, ring.isMajor ? 0.009 : 0.005, 12, 72]} />
          <meshStandardMaterial
            color={ring.isMajor ? accentColor : secondaryRingColor}
            emissive={ring.isMajor ? accentColor : '#000000'}
            emissiveIntensity={ring.isMajor ? 0.45 : 0}
            transparent
            opacity={ring.isMajor ? 0.82 : 0.35}
          />
        </mesh>
      ))}

      {/* Dual Cartographic Astrolabe Meridian Gimbals */}
      <mesh ref={gimbalOuterRef} position={[0, 0.18, 0]} rotation={[0.18, 0.4, 0]}>
        <torusGeometry args={[1.42, 0.008, 16, 96]} />
        <meshStandardMaterial
          color={secondaryRingColor}
          roughness={0.3}
          metalness={0.6}
          transparent
          opacity={isLightTheme ? 0.45 : 0.32}
        />
      </mesh>

      <mesh ref={gimbalInnerRef} position={[0, 0.18, 0]} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[1.18, 0.01, 16, 96]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.4}
          roughness={0.25}
          metalness={0.5}
        />
      </mesh>

      {/* Orbiting Solar Azimuth Node on the Meridian */}
      <mesh
        position={[
          Math.cos(solarAzimuth) * 1.42,
          0.18 + Math.sin(solarAzimuth) * 0.42,
          Math.sin(solarAzimuth) * 1.15,
        ]}
      >
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial
          color="#ffe0e0"
          emissive={accentColor}
          emissiveIntensity={1.1}
        />
      </mesh>

      {/* Active Specimen Focal Sculpture */}
      <group ref={focalGroupRef} position={[0, 0.46, 0]}>
        {specimen === 'Light' && (
          <group>
            {/* Primary Refractive Solstice Prism */}
            <mesh>
              <octahedronGeometry args={[0.26, 0]} />
              <meshStandardMaterial
                color={isLightTheme ? '#fff5eb' : '#ffe0e0'}
                emissive={accentColor}
                emissiveIntensity={0.65}
                roughness={0.12}
                metalness={0.35}
              />
            </mesh>
            {/* Outer Crystalline Cage */}
            <mesh rotation={[0.4, 0.6, 0]}>
              <octahedronGeometry args={[0.38, 0]} />
              <meshBasicMaterial color={accentColor} wireframe transparent opacity={0.65} />
            </mesh>
            {/* Equatorial Prism Halo */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.52, 0.008, 12, 64]} />
              <meshBasicMaterial color={secondaryRingColor} transparent opacity={0.6} />
            </mesh>
          </group>
        )}

        {specimen === 'Nature' && (
          <group>
            {/* Unfurling Botanical Phyllotaxis Spire */}
            {[0, 1, 2, 3, 4, 5].map((tier) => {
              const tierScale = 0.28 - tier * 0.035;
              const tierY = -0.18 + tier * 0.09;
              return (
                <mesh
                  key={tier}
                  position={[0, tierY, 0]}
                  rotation={[0.22, tier * 1.05, 0.18]}
                >
                  <coneGeometry args={[tierScale, 0.14, 5]} />
                  <meshStandardMaterial
                    color={tier % 2 === 0 ? accentColor : secondaryRingColor}
                    emissive={accentColor}
                    emissiveIntensity={0.38}
                    roughness={0.28}
                    metalness={0.2}
                    flatShading
                  />
                </mesh>
              );
            })}
          </group>
        )}

        {specimen === 'Sound' && (
          <group>
            {/* Harmonic Resonator Core & Concentric Acoustic Rings */}
            <mesh>
              <icosahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial
                color={secondaryRingColor}
                emissive={accentColor}
                emissiveIntensity={0.75}
                roughness={0.18}
                metalness={0.45}
              />
            </mesh>
            {[0.34, 0.5, 0.68].map((rad, i) => (
              <mesh key={i} rotation={[Math.PI / 2 + i * 0.22, i * 0.35, 0]}>
                <torusGeometry args={[rad, 0.009, 12, 64]} />
                <meshStandardMaterial
                  color={accentColor}
                  emissive={accentColor}
                  emissiveIntensity={0.55 - i * 0.12}
                />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Atmospheric Dust Motes */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.032}
          color={accentColor}
          transparent
          opacity={isLightTheme ? 0.55 : 0.75}
        />
      </points>
    </group>
  );
};

export const StaticTopographyFallback: React.FC<{
  sunAngle: number;
  specimen?: ObservatorySpecimenKey;
}> = ({ sunAngle, specimen = 'Light' }) => {
  const offsetX = Math.round((sunAngle - 0.5) * 36);
  const sunCx = 210 + Math.round(Math.cos(sunAngle * Math.PI) * 128);
  const sunCy = 152 - Math.round(Math.sin(sunAngle * Math.PI) * 58);

  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '340px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--topo-canvas-bg)',
      }}
    >
      <svg
        viewBox="0 0 420 320"
        style={{ width: '94%', height: 'auto', maxWidth: '410px' }}
        fill="none"
      >
        {/* Astrolabe Meridian Gimbal Rings */}
        <ellipse
          cx="210"
          cy="168"
          rx="168"
          ry="92"
          stroke="var(--topo-stroke-subtle)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <ellipse
          cx="210"
          cy="168"
          rx="132"
          ry="118"
          stroke="var(--topo-stroke-subtle)"
          strokeWidth="1"
        />

        {/* Sculpted Iso-Contour Terraces */}
        <ellipse
          cx={210 + offsetX * 0.18}
          cy="226"
          rx="168"
          ry="54"
          fill="var(--topo-fill-1)"
          stroke="var(--topo-stroke-subtle)"
          strokeWidth="1.2"
        />
        <ellipse
          cx={210 + offsetX * 0.32}
          cy="202"
          rx="136"
          ry="44"
          fill="var(--topo-fill-2)"
          stroke="rgba(255,69,0,0.35)"
          strokeWidth="1.2"
        />
        <ellipse
          cx={212 + offsetX * 0.46}
          cy="178"
          rx="102"
          ry="33"
          fill="var(--topo-fill-3)"
          stroke="rgba(255,69,0,0.58)"
          strokeWidth="1.3"
        />
        <ellipse
          cx={214 + offsetX * 0.6}
          cy="154"
          rx="68"
          ry="22"
          fill="var(--topo-fill-4)"
          stroke="var(--accent)"
          strokeWidth="1.5"
        />

        {/* Specimen Focal Geometry */}
        <circle
          cx={214 + offsetX * 0.4}
          cy="108"
          r="28"
          fill="rgba(255, 69, 0, 0.16)"
        />
        {specimen === 'Light' && (
          <polygon
            points={`${214 + offsetX * 0.4},78 ${234 + offsetX * 0.4},108 ${214 + offsetX * 0.4},138 ${194 + offsetX * 0.4},108`}
            fill="var(--text-blush)"
            stroke="var(--accent)"
            strokeWidth="1.6"
          />
        )}
        {specimen === 'Nature' && (
          <path
            d={`M${214 + offsetX * 0.4} 138 C ${198 + offsetX * 0.4} 116, ${230 + offsetX * 0.4} 96, ${214 + offsetX * 0.4} 76`}
            stroke="var(--accent)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}
        {specimen === 'Sound' && (
          <>
            <circle
              cx={214 + offsetX * 0.4}
              cy="108"
              r="16"
              stroke="var(--accent)"
              strokeWidth="1.6"
            />
            <circle
              cx={214 + offsetX * 0.4}
              cy="108"
              r="36"
              stroke="var(--accent)"
              strokeWidth="1.1"
              strokeDasharray="3 3"
            />
          </>
        )}

        {/* Solar Azimuth Node */}
        <circle cx={sunCx} cy={sunCy} r="5.5" fill="var(--accent)" />
      </svg>
    </div>
  );
};

function detectWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

const SPECIMEN_META: Record<
  ObservatorySpecimenKey,
  { code: string; title: string; elevation: string; coordinates: string }
> = {
  Light: {
    code: 'SPECIMEN 01 / LIGHT',
    title: 'Solstice Prism & Courtyard Ridge',
    elevation: 'EL +42.8m',
    coordinates: 'AZ 214° SW / 16:42',
  },
  Nature: {
    code: 'SPECIMEN 02 / NATURE',
    title: 'Basalt Crevice & Unfurling Frond',
    elevation: 'EL +18.4m',
    coordinates: 'AZ 118° SE / 08:15',
  },
  Sound: {
    code: 'SPECIMEN 03 / SOUND',
    title: 'Harmonic Basin & Escapement Pulse',
    elevation: 'EL +29.1m',
    coordinates: 'AZ 286° NW / 18:59',
  },
};

export const PaperTopographyScene: React.FC<PaperTopographySceneProps> = ({
  activeSpecimen: controlledSpecimen,
  onSelectSpecimen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sunAngle, setSunAngle] = useState<number>(0.62);
  const [internalSpecimen, setInternalSpecimen] = useState<ObservatorySpecimenKey>('Light');
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isLightTheme, setIsLightTheme] = useState<boolean>(false);

  const specimen = controlledSpecimen || internalSpecimen;
  const meta = SPECIMEN_META[specimen];

  const handleSpecimenChange = (next: ObservatorySpecimenKey) => {
    setInternalSpecimen(next);
    onSelectSpecimen?.(next);
  };

  useEffect(() => {
    setWebGLSupported(detectWebGLSupport());
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqMobile = window.matchMedia('(max-width: 767px)');
    setReducedMotion(mqMotion.matches);
    setIsMobileViewport(mqMobile.matches);

    const checkTheme = () => {
      setIsLightTheme(document.documentElement.getAttribute('data-theme') === 'light');
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const onMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const onMobileChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mqMotion.addEventListener('change', onMotionChange);
    mqMobile.addEventListener('change', onMobileChange);

    return () => {
      observer.disconnect();
      mqMotion.removeEventListener('change', onMotionChange);
      mqMobile.removeEventListener('change', onMobileChange);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          setIsVisible(entries[0].isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canRenderLive3D = webGLSupported && !isMobileViewport;
  const azimuthDeg = Math.round(120 + sunAngle * 140);

  return (
    <div
      ref={containerRef}
      className="glass"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        padding: '1.35rem',
      }}
    >
      {/* Top Instrument Header & Specimen Selector Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div className="font-mono-meta" style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
            {meta.code}
          </div>
          <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text)' }}>
            {meta.title}
          </div>
        </div>

        <div role="group" aria-label="3D Observatory specimen mode" style={{ display: 'flex', gap: '0.35rem' }}>
          {(['Light', 'Nature', 'Sound'] as ObservatorySpecimenKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="lens-pill"
              aria-pressed={specimen === key}
              onClick={() => handleSpecimenChange(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive 3D Viewport Stage */}
      <div
        onPointerMove={(e) => {
          if (reducedMotion) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          setPointerOffset({ x: nx, y: ny });
        }}
        onPointerLeave={() => setPointerOffset({ x: 0, y: 0 })}
        style={{
          position: 'relative',
          width: '100%',
          height: '360px',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          border: '1px solid var(--line)',
          background: 'var(--topo-canvas-bg)',
          cursor: 'grab',
        }}
      >
        {canRenderLive3D ? (
          <Suspense fallback={<StaticTopographyFallback sunAngle={sunAngle} specimen={specimen} />}>
            <Canvas
              dpr={[1, 1.75]}
              camera={{ position: [0, 1.55, 3.65], fov: 36 }}
              onCreated={({ gl }) => {
                gl.setClearColor(new THREE.Color('#000000'), 0);
              }}
            >
              <ObservatoryTerrainAndSpecimen
                sunAngle={sunAngle}
                specimen={specimen}
                isLightTheme={isLightTheme}
                pointerOffset={pointerOffset}
                reducedMotion={reducedMotion}
                isVisible={isVisible}
              />
            </Canvas>
          </Suspense>
        ) : (
          <StaticTopographyFallback sunAngle={sunAngle} specimen={specimen} />
        )}

        {/* Corner Cartographic Telemetry Overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '0.85rem',
            bottom: '0.75rem',
            right: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            background: 'var(--topo-hud-bg)',
            backdropFilter: 'blur(8px)',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--line)',
          }}
        >
          <span>{meta.elevation}</span>
          <span>SOLAR AZIMUTH {azimuthDeg}°</span>
          <span>DRAG OR TILT TO INSPECT</span>
        </div>
      </div>

      {/* Solar Azimuth / Ember Light Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          padding: '0.55rem 1rem',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-pill)',
        }}
      >
        <label
          htmlFor="hero-light-angle-slider"
          className="font-mono-meta"
          style={{ color: 'var(--text-muted)' }}
        >
          Ember light angle ({azimuthDeg}°)
        </label>
        <input
          id="hero-light-angle-slider"
          type="range"
          min={0.1}
          max={0.95}
          step={0.01}
          value={sunAngle}
          onChange={(e) => setSunAngle(Number(e.target.value))}
          aria-label="Adjust ember light angle across the topographic sculpture"
          style={{ width: '150px', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};

export default PaperTopographyScene;
