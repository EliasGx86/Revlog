"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Zone } from "@/lib/types";
import { findPlateAnchor, PlateMesh, type PlateAnchor } from "./license-plate";

// Artist-made motorcycle: "Harley-Davidson Seventy-Two HD FXT 2015" by
// Alex.Ka. (https://sketchfab.com/Alex.Ka.), CC-BY-4.0 — attribution shown in
// the vehicle info modal. The source GLB is optimized (weld/simplify/quantize,
// no material merging — tinting and zone detection key off material names).
// Zones mirror the procedural bike: "hood" = engine/tank, "wheels" = both wheels.

const MODEL_URL = "/models/motorcycle.glb";
const TARGET_LENGTH = 2.6; // world units nose→tail

interface Props {
  color: string;
  licensePlate?: string | null;
  onZoneClick?: (zone: Zone) => void;
  hoveredZone?: Zone | null;
  setHoveredZone?: (zone: Zone | null) => void;
}

interface Prepared {
  object: THREE.Group;
  size: THREE.Vector3; // bbox size after normalization (x = length)
  wheelAnchors: { position: THREE.Vector3; radius: number }[];
  plateAnchor: PlateAnchor | null;
}

function prepareMotorcycle(scene: THREE.Group, color: string): Prepared {
  scene.updateMatrixWorld(true);
  const object = scene.clone(true);

  // Retint paint + light up the lamps; clone materials so instances don't
  // share tints. This model has a dedicated "body_color" material.
  const bodyColor = new THREE.Color(color);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const mapped = mats.map((m) => {
      const name = (m.name || "").toLowerCase();
      if (name === "body_color") {
        return new THREE.MeshPhysicalMaterial({
          name: "body_tinted",
          color: bodyColor,
          metalness: 0.75,
          roughness: 0.32,
          clearcoat: 1,
          clearcoatRoughness: 0.15,
        });
      }
      if (name === "headlight") {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.emissive = new THREE.Color("#ffedb0");
        c.emissiveIntensity = 0.9;
        return c;
      }
      if (name === "brakelight") {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.emissive = new THREE.Color("#c1170e");
        c.emissiveIntensity = 0.7;
        return c;
      }
      return m;
    });
    child.material = Array.isArray(child.material) ? mapped : mapped[0];
  });

  // Normalize on a wrapper (same pattern as the car pack: never mutate the
  // clone's own transform — the Sketchfab root carries a baked Z-up→Y-up
  // rotation): spin aligns the long axis to X, then scale/ground/center.
  const spin = new THREE.Group();
  spin.add(object);
  const wrapper = new THREE.Group();
  wrapper.add(spin);

  let box = new THREE.Box3().setFromObject(spin);
  let sz = box.getSize(new THREE.Vector3());
  if (sz.z > sz.x) {
    spin.rotation.y = -Math.PI / 2; // long axis → X
    box = new THREE.Box3().setFromObject(spin);
    sz = box.getSize(new THREE.Vector3());
  }

  // Nose toward +x, decided by headlight vs brakelight material positions.
  spin.updateMatrixWorld(true);
  let headX = 0, headN = 0, tailX = 0, tailN = 0;
  object.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      const mn = (m.name || "").toLowerCase();
      if (mn !== "headlight" && mn !== "brakelight") continue;
      const cx = new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()).x;
      if (mn === "headlight") { headX += cx; headN++; }
      else if (mn === "brakelight") { tailX += cx; tailN++; }
    }
  });
  if (headN && tailN && headX / headN < tailX / tailN) {
    spin.rotation.y += Math.PI;
  }
  box = new THREE.Box3().setFromObject(spin);
  sz = box.getSize(new THREE.Vector3());

  const scale = TARGET_LENGTH / sz.x;
  spin.scale.multiplyScalar(scale);
  box = new THREE.Box3().setFromObject(spin);
  const center = box.getCenter(new THREE.Vector3());
  spin.position.x -= center.x;
  spin.position.z -= center.z;
  spin.position.y -= box.min.y;
  const size = new THREE.Box3().setFromObject(spin).getSize(new THREE.Vector3());

  // Wheel anchors from the "tire" material's meshes: one mesh spans both
  // wheels, so take the ends of its bbox along X. Radius = half its height.
  wrapper.updateMatrixWorld(true);
  const tireBox = new THREE.Box3();
  object.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    if (mats.some((m) => (m.name || "").toLowerCase() === "tire")) {
      tireBox.union(new THREE.Box3().setFromObject(c));
    }
  });
  const wheelAnchors: Prepared["wheelAnchors"] = [];
  if (!tireBox.isEmpty()) {
    const r = (tireBox.max.y - tireBox.min.y) / 2;
    const cy = (tireBox.max.y + tireBox.min.y) / 2;
    wheelAnchors.push(
      { position: new THREE.Vector3(tireBox.max.x - r, cy, 0), radius: r },
      { position: new THREE.Vector3(tireBox.min.x + r, cy, 0), radius: r }
    );
  }

  // Rear plate mount: raycast into the tail (hits the rear fender, so the
  // plate tilts with the fender's surface normal like a real fender mount).
  const plateAnchor =
    findPlateAnchor(object, { y: size.y * 0.45, fromX: -size.x }) ??
    findPlateAnchor(object, { y: size.y * 0.55, fromX: -size.x });

  return { object: wrapper, size, wheelAnchors, plateAnchor };
}

export default function GlbMotorcycleModel({
  color,
  licensePlate,
  onZoneClick,
  hoveredZone,
  setHoveredZone,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  const { object, size, wheelAnchors, plateAnchor } = useMemo(
    () => prepareMotorcycle(scene, color),
    [scene, color]
  );

  useFrame((_, dt) => {
    if (root.current && !hoveredZone) {
      root.current.rotation.y += dt * 0.15;
    }
  });

  const zoneHandlers = (zone: Zone) => ({
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
  });

  const hitboxMaterial = (zone: Zone) => (
    <meshBasicMaterial
      color="#ff5722"
      transparent
      opacity={hoveredZone === zone ? 0.22 : 0}
      depthWrite={false}
    />
  );

  const L = size.x, H = size.y, W = size.z;

  const plateText = licensePlate?.trim();

  return (
    <group ref={root}>
      <primitive object={object} />

      {/* user's license plate on the rear fender */}
      {plateText && plateAnchor && (
        <PlateMesh anchor={plateAnchor} text={plateText} width={L * 0.09} />
      )}

      {/* ENGINE + TANK hit-box ("hood" zone): mid-bike, above the wheels */}
      <mesh position={[L * 0.05, H * 0.5, 0]} {...zoneHandlers("hood")}>
        <boxGeometry args={[L * 0.44, H * 0.5, W * 1.1]} />
        {hitboxMaterial("hood")}
      </mesh>

      {/* WHEEL hit-boxes at each end of the tire span */}
      {wheelAnchors.map((w, i) => (
        <mesh key={i} position={w.position} {...zoneHandlers("wheels")}>
          <sphereGeometry args={[w.radius * 1.2, 12, 12]} />
          {hitboxMaterial("wheels")}
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
