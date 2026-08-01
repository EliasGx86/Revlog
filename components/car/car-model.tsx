"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { BodyType, Zone } from "@/lib/types";

// Stylized low-poly procedural car. Body type changes proportions.
// Each interactive zone is a separate mesh group so we can attach hover/click handlers.

interface Props {
  bodyType: BodyType;
  color: string;
  onZoneClick?: (zone: Zone) => void;
  hoveredZone?: Zone | null;
  setHoveredZone?: (zone: Zone | null) => void;
}

// Tunable proportions per body type.
const PROPORTIONS: Record<
  BodyType,
  {
    bodyLen: number; bodyWidth: number; bodyHeight: number;
    cabinLen: number; cabinHeight: number; cabinForward: number;  // cabin position from center
    hoodLen: number;
    wheelRadius: number; wheelTrack: number; wheelbase: number;
    rideHeight: number;
    bedLen?: number; // truck only
  }
> = {
  sedan: {
    bodyLen: 4.6, bodyWidth: 1.8, bodyHeight: 0.55,
    cabinLen: 2.2, cabinHeight: 0.85, cabinForward: -0.05,
    hoodLen: 1.35,
    wheelRadius: 0.36, wheelTrack: 1.55, wheelbase: 2.7,
    rideHeight: 0.36,
  },
  suv: {
    bodyLen: 4.7, bodyWidth: 1.95, bodyHeight: 0.65,
    cabinLen: 2.6, cabinHeight: 1.1, cabinForward: 0.05,
    hoodLen: 1.2,
    wheelRadius: 0.42, wheelTrack: 1.65, wheelbase: 2.8,
    rideHeight: 0.46,
  },
  truck: {
    bodyLen: 5.4, bodyWidth: 1.95, bodyHeight: 0.6,
    cabinLen: 1.7, cabinHeight: 1.05, cabinForward: -0.5,
    hoodLen: 1.4,
    wheelRadius: 0.45, wheelTrack: 1.7, wheelbase: 3.3,
    rideHeight: 0.5,
    bedLen: 1.9,
  },
};

export default function CarModel({
  bodyType,
  color,
  onZoneClick,
  hoveredZone,
  setHoveredZone,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const p = PROPORTIONS[bodyType];

  useFrame((_, dt) => {
    // Gentle idle rotation when nothing is hovered.
    if (root.current && !hoveredZone) {
      root.current.rotation.y += dt * 0.15;
    }
  });

  const bodyColor = new THREE.Color(color);
  const darkTrim = new THREE.Color("#1a1a1d");
  const glass = new THREE.Color("#5b6f7c");
  const tire = new THREE.Color("#0e0e10");
  const rim = new THREE.Color("#9a9a9f");

  const halfLen = p.bodyLen / 2;

  // Highlight color for hovered zone
  const zoneEmissive = (zone: Zone) =>
    hoveredZone === zone ? new THREE.Color("#ff5722") : new THREE.Color("#000000");

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* ground shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} receiveShadow>
        <circleGeometry args={[3.2, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>

      {/* main body shell (chassis, fenders) */}
      <mesh
        position={[0, p.rideHeight + p.bodyHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[p.bodyLen, p.bodyHeight, p.bodyWidth]} />
        <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.35} />
      </mesh>

      {/* HOOD ZONE (front of car) */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onZoneClick?.("hood");
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredZone?.("hood");
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHoveredZone?.(null);
          document.body.style.cursor = "auto";
        }}
      >
        <mesh
          position={[
            halfLen - p.hoodLen / 2,
            p.rideHeight + p.bodyHeight + 0.06,
            0,
          ]}
          castShadow
        >
          <boxGeometry args={[p.hoodLen, 0.12, p.bodyWidth - 0.05]} />
          <meshStandardMaterial
            color={bodyColor}
            metalness={0.55}
            roughness={0.35}
            emissive={zoneEmissive("hood")}
            emissiveIntensity={hoveredZone === "hood" ? 0.35 : 0}
          />
        </mesh>
        {/* grille / front fascia */}
        <mesh
          position={[halfLen - 0.02, p.rideHeight + p.bodyHeight / 2, 0]}
          castShadow
        >
          <boxGeometry args={[0.08, p.bodyHeight - 0.1, p.bodyWidth - 0.2]} />
          <meshStandardMaterial color={darkTrim} metalness={0.4} roughness={0.6} />
        </mesh>
        {/* headlights */}
        <mesh position={[halfLen - 0.02, p.rideHeight + p.bodyHeight - 0.1, p.bodyWidth / 2 - 0.25]}>
          <boxGeometry args={[0.06, 0.12, 0.25]} />
          <meshStandardMaterial color="#fff8d8" emissive="#fff8d8" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[halfLen - 0.02, p.rideHeight + p.bodyHeight - 0.1, -p.bodyWidth / 2 + 0.25]}>
          <boxGeometry args={[0.06, 0.12, 0.25]} />
          <meshStandardMaterial color="#fff8d8" emissive="#fff8d8" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* CABIN (with WINDSHIELD ZONE on the front-facing glass) */}
      <group
        position={[
          p.cabinForward,
          p.rideHeight + p.bodyHeight + p.cabinHeight / 2,
          0,
        ]}
      >
        <mesh castShadow>
          <boxGeometry args={[p.cabinLen, p.cabinHeight, p.bodyWidth - 0.15]} />
          <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.35} />
        </mesh>
        {/* windshield (front-facing glass slab — clickable) */}
        <mesh
          position={[p.cabinLen / 2 - 0.001, 0, 0]}
          rotation={[0, 0, -0.25]}
          onClick={(e) => {
            e.stopPropagation();
            onZoneClick?.("windshield");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredZone?.("windshield");
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHoveredZone?.(null);
            document.body.style.cursor = "auto";
          }}
        >
          <boxGeometry args={[0.05, p.cabinHeight - 0.15, p.bodyWidth - 0.3]} />
          <meshStandardMaterial
            color={glass}
            metalness={0.2}
            roughness={0.05}
            transparent
            opacity={0.55}
            emissive={zoneEmissive("windshield")}
            emissiveIntensity={hoveredZone === "windshield" ? 0.5 : 0}
          />
        </mesh>
        {/* rear window */}
        <mesh position={[-p.cabinLen / 2 + 0.001, 0, 0]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.05, p.cabinHeight - 0.2, p.bodyWidth - 0.35]} />
          <meshStandardMaterial color={glass} metalness={0.2} roughness={0.05} transparent opacity={0.45} />
        </mesh>
        {/* side windows */}
        <mesh position={[0, 0.05, p.bodyWidth / 2 - 0.075]}>
          <boxGeometry args={[p.cabinLen - 0.4, p.cabinHeight - 0.35, 0.04]} />
          <meshStandardMaterial color={glass} metalness={0.2} roughness={0.05} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, 0.05, -(p.bodyWidth / 2 - 0.075)]}>
          <boxGeometry args={[p.cabinLen - 0.4, p.cabinHeight - 0.35, 0.04]} />
          <meshStandardMaterial color={glass} metalness={0.2} roughness={0.05} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Truck bed */}
      {bodyType === "truck" && p.bedLen && (
        <group position={[-halfLen + p.bedLen / 2 + 0.1, p.rideHeight + p.bodyHeight + 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[p.bedLen, 0.5, p.bodyWidth - 0.05]} />
            <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[p.bedLen - 0.1, 0.05, p.bodyWidth - 0.2]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      )}

      {/* WHEELS ZONE — all four wheels grouped, single click target */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onZoneClick?.("wheels");
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredZone?.("wheels");
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHoveredZone?.(null);
          document.body.style.cursor = "auto";
        }}
      >
        {[
          [p.wheelbase / 2,  p.wheelTrack / 2],
          [p.wheelbase / 2, -p.wheelTrack / 2],
          [-p.wheelbase / 2, p.wheelTrack / 2],
          [-p.wheelbase / 2, -p.wheelTrack / 2],
        ].map(([x, z], i) => (
          <group key={i} position={[x, p.wheelRadius, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[p.wheelRadius, p.wheelRadius, 0.32, 24]} />
              <meshStandardMaterial color={tire} roughness={0.95} />
            </mesh>
            {/* rim */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
              <cylinderGeometry args={[p.wheelRadius * 0.55, p.wheelRadius * 0.55, 0.34, 16]} />
              <meshStandardMaterial
                color={rim}
                metalness={0.8}
                roughness={0.25}
                emissive={zoneEmissive("wheels")}
                emissiveIntensity={hoveredZone === "wheels" ? 0.4 : 0}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
