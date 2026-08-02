"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  MeshReflectorMaterial,
} from "@react-three/drei";
import CarModel from "./car-model";
import GlbVehicleModel from "./glb-vehicle-model";
import GlbMotorcycleModel from "./glb-motorcycle-model";
import type { BodyType, Zone } from "@/lib/types";

interface Props {
  bodyType: BodyType;
  color: string;
  onZoneClick: (zone: Zone) => void;
  /** Dev-only: lets the /dev/models page read canvas pixels for snapshots. */
  preserveBuffer?: boolean;
}

// Dev-only (mounted when preserveBuffer is set): lets tooling force a render
// and grab pixels even when the tab isn't compositing (hidden pane = no rAF).
function DevSnapHook() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__snap = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
  }, [gl, scene, camera]);
  return null;
}

export default function CarScene({ bodyType, color, onZoneClick, preserveBuffer }: Props) {
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [6.2, 2.8, 6.2], fov: 33 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: preserveBuffer }}
      >
        <color attach="background" args={["#08080a"]} />
        <fog attach="fog" args={["#08080a", 13, 26]} />

        {/* showroom lighting: warm key, cool fill, overhead rim */}
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[6, 7, 4]}
          intensity={1.5}
          color="#fff4e6"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#88aaff" />
        <spotLight
          position={[0, 9, -5]}
          intensity={220}
          angle={0.55}
          penumbra={1}
          color="#ffffff"
        />

        <Environment preset="city" />

        {/* polished showroom floor */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
          <circleGeometry args={[22, 48]} />
          <MeshReflectorMaterial
            color="#0b0b0e"
            metalness={0.5}
            roughness={0.75}
            mirror={0.35}
            resolution={512}
            blur={[300, 80]}
            mixBlur={0.9}
            mixStrength={1.6}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
          />
        </mesh>

        {/* soft grounding shadow under the vehicle */}
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.6}
          scale={13}
          blur={2.4}
          far={3.5}
          resolution={512}
          color="#000000"
        />

        {bodyType === "motorcycle" ? (
          // Artist-made Harley; falls back to the procedural bike while loading.
          <Suspense
            fallback={
              <CarModel
                bodyType={bodyType}
                color={color}
                onZoneClick={onZoneClick}
                hoveredZone={hoveredZone}
                setHoveredZone={setHoveredZone}
              />
            }
          >
            <GlbMotorcycleModel
              color={color}
              onZoneClick={onZoneClick}
              hoveredZone={hoveredZone}
              setHoveredZone={setHoveredZone}
            />
          </Suspense>
        ) : (
          // Artist-made pack model; falls back to the procedural car while loading.
          <Suspense
            fallback={
              <CarModel
                bodyType={bodyType}
                color={color}
                onZoneClick={onZoneClick}
                hoveredZone={hoveredZone}
                setHoveredZone={setHoveredZone}
              />
            }
          >
            <GlbVehicleModel
              bodyType={bodyType}
              color={color}
              onZoneClick={onZoneClick}
              hoveredZone={hoveredZone}
              setHoveredZone={setHoveredZone}
            />
          </Suspense>
        )}

        {preserveBuffer && <DevSnapHook />}

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={4.5}
          maxDistance={13}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.15}
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
