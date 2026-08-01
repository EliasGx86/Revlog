"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import CarModel from "./car-model";
import type { BodyType, Zone } from "@/lib/types";

interface Props {
  bodyType: BodyType;
  color: string;
  onZoneClick: (zone: Zone) => void;
}

export default function CarScene({ bodyType, color, onZoneClick }: Props) {
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [6, 3.5, 6], fov: 35 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0a0a0b"]} />
        <fog attach="fog" args={["#0a0a0b", 14, 28]} />

        {/* lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-6, 5, -3]} intensity={0.4} color="#88aaff" />

        <Environment preset="city" />

        {/* ground */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#0d0d10" roughness={1} />
        </mesh>

        <CarModel
          bodyType={bodyType}
          color={color}
          onZoneClick={onZoneClick}
          hoveredZone={hoveredZone}
          setHoveredZone={setHoveredZone}
        />

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={5}
          maxDistance={12}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate={false}
        />
      </Canvas>

      {hoveredZone && (
        <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-surface/90 px-4 py-1.5 text-sm capitalize backdrop-blur-sm">
          {bodyType === "motorcycle" && hoveredZone === "hood" ? "engine" : hoveredZone}
        </div>
      )}
    </div>
  );
}
