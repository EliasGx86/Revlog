"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { BodyType, Zone } from "@/lib/types";

// Stylized procedural vehicles. The body is an extruded side-profile silhouette
// (real hood/windshield/roof slopes + wheel arches cut into the fenders) rather
// than stacked boxes. Each interactive zone is its own mesh/group so hover and
// click handlers attach cleanly.

interface Props {
  bodyType: BodyType;
  color: string;
  onZoneClick?: (zone: Zone) => void;
  hoveredZone?: Zone | null;
  setHoveredZone?: (zone: Zone | null) => void;
}

const HIGHLIGHT = new THREE.Color("#ff5722");
const BLACK = new THREE.Color("#000000");

interface Profile {
  width: number;
  wheelRadius: number;
  wheelX: number;      // ± wheelbase/2
  bottomY: number;     // rocker height (bottom of body sides)
  archR: number;       // wheel-arch cutout radius
  // Side silhouette of the lower body only (stops at the beltline) so the
  // glass greenhouse above it stays visible.
  outline: [number, number][];
  // Glass greenhouse silhouette (closed by a straight beltline).
  glass: [number, number][];
  hood: { front: [number, number]; rear: [number, number] };
  roof: { front: [number, number]; rear: [number, number] }; // painted roof cap
  mirror: [number, number]; // x,y of mirror mount
  bed?: { x: number; len: number; y: number }; // truck bed interior
}

const PROFILES: Record<Exclude<BodyType, "motorcycle">, Profile> = {
  sedan: {
    width: 1.8, wheelRadius: 0.36, wheelX: 1.35, bottomY: 0.3, archR: 0.47,
    outline: [
      [2.3, 0.3], [2.38, 0.52], [2.33, 0.7], [1.1, 0.84],
      [-1.55, 0.9], [-2.22, 0.86], [-2.36, 0.56], [-2.3, 0.3],
    ],
    glass: [[1.0, 0.86], [0.5, 1.28], [-0.58, 1.31], [-1.45, 0.9]],
    hood: { front: [2.33, 0.7], rear: [1.1, 0.84] },
    roof: { front: [0.5, 1.28], rear: [-0.58, 1.31] },
    mirror: [0.95, 0.94],
  },
  suv: {
    width: 1.95, wheelRadius: 0.42, wheelX: 1.42, bottomY: 0.38, archR: 0.55,
    outline: [
      [2.35, 0.38], [2.43, 0.62], [2.38, 0.87], [1.15, 0.97],
      [0.4, 1.02], [-2.2, 1.0], [-2.4, 0.62], [-2.35, 0.38],
    ],
    glass: [[1.08, 0.99], [0.64, 1.52], [-1.55, 1.55], [-2.1, 1.47], [-2.16, 0.99]],
    hood: { front: [2.38, 0.87], rear: [1.15, 0.97] },
    roof: { front: [0.64, 1.52], rear: [-1.55, 1.55] },
    mirror: [1.0, 1.06],
  },
  truck: {
    width: 1.95, wheelRadius: 0.45, wheelX: 1.7, bottomY: 0.42, archR: 0.59,
    outline: [
      [2.7, 0.42], [2.78, 0.68], [2.73, 0.97], [1.35, 1.05],
      [0.6, 1.12], [-2.58, 1.08], [-2.68, 0.96], [-2.73, 0.68], [-2.66, 0.42],
    ],
    glass: [[1.28, 1.09], [0.9, 1.6], [-0.12, 1.62], [-0.36, 1.09]],
    hood: { front: [2.73, 0.97], rear: [1.35, 1.05] },
    roof: { front: [0.9, 1.6], rear: [-0.12, 1.62] },
    mirror: [1.22, 1.16],
    bed: { x: -1.5, len: 2.0, y: 1.13 },
  },
};

// Extruded silhouette with wheel arches cut out of the bottom edge.
function useBodyGeometry(p: Profile) {
  return useMemo(() => {
    const s = new THREE.Shape();
    const [x0, y0] = p.outline[0];
    s.moveTo(x0, y0);
    for (let i = 1; i < p.outline.length; i++) s.lineTo(p.outline[i][0], p.outline[i][1]);
    // bottom edge, rear → front, arching over each wheel
    const rear = -p.wheelX, front = p.wheelX;
    s.lineTo(rear - p.archR, p.bottomY);
    s.absarc(rear, p.bottomY, p.archR, Math.PI, 0, true);
    s.lineTo(front - p.archR, p.bottomY);
    s.absarc(front, p.bottomY, p.archR, Math.PI, 0, true);
    s.closePath();

    const depth = p.width - 0.18;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.07,
      bevelSegments: 3,
      curveSegments: 14,
    });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }, [p]);
}

function useGlassGeometry(p: Profile) {
  return useMemo(() => {
    const s = new THREE.Shape();
    const [x0, y0] = p.glass[0];
    s.moveTo(x0, y0);
    for (let i = 1; i < p.glass.length; i++) s.lineTo(p.glass[i][0], p.glass[i][1]);
    s.closePath();
    const depth = p.width - 0.5;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }, [p]);
}

function zoneHandlers(
  zone: Zone,
  onZoneClick?: (z: Zone) => void,
  setHoveredZone?: (z: Zone | null) => void
) {
  return {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onZoneClick?.(zone);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHoveredZone?.(zone);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHoveredZone?.(null);
      document.body.style.cursor = "auto";
    },
  };
}

// Torus tire + dished rim with spokes.
function Wheel({ r, highlight }: { r: number; highlight: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <torusGeometry args={[r * 0.7, r * 0.32, 14, 28]} />
        <meshStandardMaterial color="#0c0c0e" roughness={0.94} />
      </mesh>
      {/* rim barrel */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.56, r * 0.56, r * 0.42, 20]} />
        <meshStandardMaterial
          color="#b9bbc0"
          metalness={0.9}
          roughness={0.18}
          emissive={highlight ? HIGHLIGHT : BLACK}
          emissiveIntensity={highlight ? 0.45 : 0}
        />
      </mesh>
      {/* spokes, both faces */}
      {[r * 0.24, -r * 0.24].map((z, side) =>
        [0, 1, 2, 3, 4].map((i) => (
          <group key={`${side}-${i}`} rotation={[0, 0, (i * Math.PI * 2) / 5]}>
            <mesh position={[r * 0.28, 0, z]}>
              <boxGeometry args={[r * 0.55, r * 0.13, r * 0.07]} />
              <meshStandardMaterial color="#d2d4d8" metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        ))
      )}
      {/* hub */}
      <mesh>
        <sphereGeometry args={[r * 0.14, 12, 12]} />
        <meshStandardMaterial color="#8e9094" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

export default function CarModel(props: Props) {
  if (props.bodyType === "motorcycle") return <MotorcycleModel {...props} />;
  return <FourWheelModel {...props} />;
}

function FourWheelModel({
  bodyType,
  color,
  onZoneClick,
  hoveredZone,
  setHoveredZone,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const p = PROFILES[bodyType as Exclude<BodyType, "motorcycle">];
  const bodyGeo = useBodyGeometry(p);
  const glassGeo = useGlassGeometry(p);

  useFrame((_, dt) => {
    if (root.current && !hoveredZone) {
      root.current.rotation.y += dt * 0.15;
    }
  });

  const bodyColor = useMemo(() => new THREE.Color(color), [color]);
  const halfW = p.width / 2;

  // Hood overlay panel: sits just above the hood slope, tinted like the body,
  // lights up on hover. Angle derived from the profile's hood segment.
  const [hf, hr] = [p.hood.front, p.hood.rear];
  const hoodLen = Math.hypot(hf[0] - hr[0], hf[1] - hr[1]) - 0.12;
  const hoodAngle = Math.atan2(hf[1] - hr[1], hf[0] - hr[0]);
  const hoodMid: [number, number] = [(hf[0] + hr[0]) / 2, (hf[1] + hr[1]) / 2 + 0.055];

  // Painted roof cap over the glass greenhouse.
  const [rf, rr] = [p.roof.front, p.roof.rear];
  const roofLen = Math.hypot(rf[0] - rr[0], rf[1] - rr[1]) - 0.02;
  const roofAngle = Math.atan2(rf[1] - rr[1], rf[0] - rr[0]);
  const roofMid: [number, number] = [(rf[0] + rr[0]) / 2, (rf[1] + rr[1]) / 2 + 0.005];

  const paint = (zone?: Zone) => (
    <meshPhysicalMaterial
      color={bodyColor}
      metalness={0.85}
      roughness={0.28}
      clearcoat={1}
      clearcoatRoughness={0.12}
      envMapIntensity={1.1}
      emissive={zone && hoveredZone === zone ? HIGHLIGHT : BLACK}
      emissiveIntensity={zone && hoveredZone === zone ? 0.35 : 0}
    />
  );

  return (
    <group ref={root}>
      {/* body silhouette */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        {paint()}
      </mesh>

      {/* glass greenhouse — clickable as the WINDSHIELD zone */}
      <mesh
        geometry={glassGeo}
        castShadow
        {...zoneHandlers("windshield", onZoneClick, setHoveredZone)}
      >
        <meshPhysicalMaterial
          color="#25333c"
          metalness={0.2}
          roughness={0.06}
          transparent
          opacity={0.9}
          envMapIntensity={1.6}
          emissive={hoveredZone === "windshield" ? HIGHLIGHT : BLACK}
          emissiveIntensity={hoveredZone === "windshield" ? 0.4 : 0}
        />
      </mesh>

      {/* roof cap */}
      <mesh
        position={[roofMid[0], roofMid[1], 0]}
        rotation={[0, 0, roofAngle]}
        castShadow
      >
        <boxGeometry args={[roofLen, 0.06, p.width - 0.52]} />
        {paint()}
      </mesh>

      {/* HOOD zone overlay */}
      <group {...zoneHandlers("hood", onZoneClick, setHoveredZone)}>
        <mesh
          position={[hoodMid[0], hoodMid[1], 0]}
          rotation={[0, 0, hoodAngle]}
          castShadow
        >
          <boxGeometry args={[hoodLen, 0.05, p.width - 0.55]} />
          {paint("hood")}
        </mesh>
        {/* grille */}
        <RoundedBox
          args={[0.09, 0.26, p.width - 0.75]}
          radius={0.03}
          position={[p.outline[1][0] + 0.015, p.outline[1][1] + 0.1, 0]}
        >
          <meshStandardMaterial color="#141417" metalness={0.5} roughness={0.5} />
        </RoundedBox>
        {/* headlights */}
        {[halfW - 0.32, -(halfW - 0.32)].map((z, i) => (
          <mesh key={i} position={[p.outline[1][0] + 0.02, p.outline[1][1] + 0.24, z]}>
            <boxGeometry args={[0.06, 0.09, 0.3]} />
            <meshStandardMaterial color="#fff6d8" emissive="#ffedb0" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* front & rear bumpers */}
      <RoundedBox
        args={[0.22, 0.3, p.width - 0.2]}
        radius={0.06}
        position={[p.outline[0][0] + 0.02, p.outline[0][1] + 0.12, 0]}
        castShadow
      >
        <meshStandardMaterial color="#1b1b1f" metalness={0.4} roughness={0.6} />
      </RoundedBox>
      <RoundedBox
        args={[0.2, 0.28, p.width - 0.2]}
        radius={0.06}
        position={[p.outline[p.outline.length - 1][0] - 0.04, p.outline[p.outline.length - 1][1] + 0.12, 0]}
        castShadow
      >
        <meshStandardMaterial color="#1b1b1f" metalness={0.4} roughness={0.6} />
      </RoundedBox>

      {/* tail lights */}
      {[halfW - 0.3, -(halfW - 0.3)].map((z, i) => (
        <mesh
          key={i}
          position={[p.outline[p.outline.length - 2][0] - 0.02, p.outline[p.outline.length - 2][1] + 0.28, z]}
        >
          <boxGeometry args={[0.05, 0.1, 0.28]} />
          <meshStandardMaterial color="#ff3b30" emissive="#c1170e" emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
      ))}

      {/* license plate */}
      <mesh position={[p.outline[p.outline.length - 2][0] - 0.06, p.outline[p.outline.length - 2][1] + 0.08, 0]}>
        <boxGeometry args={[0.02, 0.16, 0.5]} />
        <meshStandardMaterial color="#e8e8e2" roughness={0.6} />
      </mesh>

      {/* side mirrors */}
      {[halfW + 0.1, -(halfW + 0.1)].map((z, i) => (
        <group key={i} position={[p.mirror[0], p.mirror[1], z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
            <meshStandardMaterial color="#1b1b1f" roughness={0.6} />
          </mesh>
          <RoundedBox args={[0.1, 0.14, 0.06]} radius={0.02} position={[0, 0.04, z > 0 ? 0.06 : -0.06]}>
            {paint()}
          </RoundedBox>
        </group>
      ))}

      {/* shark-fin antenna */}
      <mesh position={[-0.9, p.outline[5][1] + 0.03, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.05, 0.16, 8]} />
        <meshStandardMaterial color="#141417" roughness={0.5} />
      </mesh>

      {/* truck bed interior */}
      {p.bed && (
        <>
          {/* bed floor, proud of the rails so it reads from above */}
          <mesh position={[p.bed.x, p.bed.y, 0]}>
            <boxGeometry args={[p.bed.len, 0.12, p.width - 0.45]} />
            <meshStandardMaterial color="#141417" roughness={0.92} />
          </mesh>
          {/* tailgate cap */}
          <mesh position={[p.bed.x - p.bed.len / 2 - 0.08, p.bed.y + 0.05, 0]}>
            <boxGeometry args={[0.06, 0.05, p.width - 0.45]} />
            <meshStandardMaterial color="#141417" roughness={0.92} />
          </mesh>
        </>
      )}

      {/* exhaust */}
      <mesh
        position={[-p.outline[0][0] - 0.02, p.bottomY - 0.02, halfW - 0.35]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.05, 0.06, 0.18, 12]} />
        <meshStandardMaterial color="#8e9094" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* WHEELS zone */}
      <group {...zoneHandlers("wheels", onZoneClick, setHoveredZone)}>
        {[
          [p.wheelX, halfW - 0.12],
          [p.wheelX, -(halfW - 0.12)],
          [-p.wheelX, halfW - 0.12],
          [-p.wheelX, -(halfW - 0.12)],
        ].map(([x, z], i) => (
          <group key={i} position={[x, p.wheelRadius, z]}>
            <Wheel r={p.wheelRadius} highlight={hoveredZone === "wheels"} />
          </group>
        ))}
      </group>
    </group>
  );
}

// Stylized motorcycle. Zones: "hood" = engine/tank, "wheels" = both wheels.
function MotorcycleModel({ color, onZoneClick, hoveredZone, setHoveredZone }: Props) {
  const root = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (root.current && !hoveredZone) {
      root.current.rotation.y += dt * 0.15;
    }
  });

  const bodyColor = useMemo(() => new THREE.Color(color), [color]);
  const wheelR = 0.5;

  const hoodHot = hoveredZone === "hood";
  const wheelsHot = hoveredZone === "wheels";

  return (
    <group ref={root}>
      {/* frame spine */}
      <mesh position={[0, 0.85, 0]} rotation={[0, 0, -0.08]} castShadow>
        <boxGeometry args={[1.9, 0.13, 0.15]} />
        <meshStandardMaterial color="#17171a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* ENGINE + TANK ZONE */}
      <group {...zoneHandlers("hood", onZoneClick, setHoveredZone)}>
        <RoundedBox args={[0.75, 0.5, 0.42]} radius={0.06} position={[0.1, 0.6, 0]} castShadow>
          <meshStandardMaterial
            color="#75757c"
            metalness={0.9}
            roughness={0.25}
            emissive={hoodHot ? HIGHLIGHT : BLACK}
            emissiveIntensity={hoodHot ? 0.35 : 0}
          />
        </RoundedBox>
        {/* cylinder fins */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.1, 0.86 + i * 0.055, 0]} castShadow>
            <boxGeometry args={[0.42 - i * 0.03, 0.03, 0.5]} />
            <meshStandardMaterial color="#232327" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        {/* fuel tank — capsule reads far rounder than a box */}
        <mesh position={[0.45, 1.1, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]} castShadow>
          <capsuleGeometry args={[0.21, 0.5, 8, 16]} />
          <meshPhysicalMaterial
            color={bodyColor}
            metalness={0.85}
            roughness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.1}
            emissive={hoodHot ? HIGHLIGHT : BLACK}
            emissiveIntensity={hoodHot ? 0.35 : 0}
          />
        </mesh>
      </group>

      {/* seat */}
      <RoundedBox args={[0.85, 0.15, 0.4]} radius={0.05} position={[-0.45, 1.02, 0]} castShadow>
        <meshStandardMaterial color="#131316" roughness={0.92} />
      </RoundedBox>
      {/* tail cowl */}
      <RoundedBox args={[0.45, 0.2, 0.38]} radius={0.07} position={[-0.95, 1.1, 0]} rotation={[0, 0, 0.25]} castShadow>
        <meshPhysicalMaterial color={bodyColor} metalness={0.85} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      {/* rear swingarm */}
      <mesh position={[-0.75, 0.5, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.9, 0.09, 0.13]} />
        <meshStandardMaterial color="#17171a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* front fork */}
      {[0.12, -0.12].map((z, i) => (
        <mesh key={i} position={[1.0, 0.85, z]} rotation={[0, 0, -0.42]} castShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.85, 12]} />
          <meshStandardMaterial color="#c0c2c6" metalness={0.9} roughness={0.15} />
        </mesh>
      ))}
      {/* handlebar */}
      <mesh position={[0.82, 1.32, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.72, 12]} />
        <meshStandardMaterial color="#17171a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* headlight */}
      <mesh position={[1.05, 1.12, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#fff6d8" emissive="#ffedb0" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {/* exhaust */}
      <mesh position={[-0.55, 0.42, 0.24]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.068, 1.1, 12]} />
        <meshStandardMaterial color="#c0c2c6" metalness={0.95} roughness={0.12} />
      </mesh>

      {/* fenders — half-torus hugging each wheel */}
      {[
        { x: 1.15, y: wheelR, rot: 0.25 },
        { x: -1.15, y: wheelR, rot: -0.35 },
      ].map((f, i) => (
        <mesh key={i} position={[f.x, f.y, 0]} rotation={[0, 0, f.rot]} castShadow>
          <torusGeometry args={[wheelR + 0.1, 0.045, 10, 20, Math.PI * 0.85]} />
          <meshPhysicalMaterial color={bodyColor} metalness={0.85} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
      ))}

      {/* WHEELS zone */}
      <group {...zoneHandlers("wheels", onZoneClick, setHoveredZone)}>
        {[1.15, -1.15].map((x, i) => (
          <group key={i} position={[x, wheelR, 0]}>
            <mesh castShadow>
              <torusGeometry args={[wheelR * 0.72, wheelR * 0.28, 14, 28]} />
              <meshStandardMaterial color="#0c0c0e" roughness={0.94} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[wheelR * 0.5, wheelR * 0.5, 0.2, 20]} />
              <meshStandardMaterial
                color="#b9bbc0"
                metalness={0.9}
                roughness={0.18}
                emissive={wheelsHot ? HIGHLIGHT : BLACK}
                emissiveIntensity={wheelsHot ? 0.45 : 0}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
