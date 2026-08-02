"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { BodyType, Zone } from "@/lib/types";
import { findPlateAnchor, PlateMesh, type PlateAnchor } from "./license-plate";

// Artist-made vehicles from the "Free Low Poly Vehicles Pack" by RgsDev
// (https://sketchfab.com/rgsdev), licensed CC-BY-4.0 — attribution shown in
// the app footer/about. The pack ships 17 vehicles in one GLB; we pull the
// node we need, retint the body materials to the user's color, and overlay
// invisible hit-boxes for the hood / windshield / wheels service zones.

const MODEL_URL = "/models/vehicles.glb";

const NODE_NAMES: Record<Exclude<BodyType, "motorcycle">, string> = {
  sedan: "Sedan",
  suv: "SUV",
  truck: "Pickup",
};

// World units each vehicle should span nose→tail.
const TARGET_LENGTHS: Record<Exclude<BodyType, "motorcycle">, number> = {
  sedan: 4.5,
  suv: 4.7,
  truck: 5.2,
};

// Zone hit-box centers as fractions of body length (+x = nose). A pickup's
// hood/windshield sit much further forward than a sedan's.
const ZONE_LAYOUT: Record<
  Exclude<BodyType, "motorcycle">,
  { hoodX: number; windshieldX: number }
> = {
  sedan: { hoodX: 0.3, windshieldX: 0.0 },
  suv: { hoodX: 0.33, windshieldX: 0.03 },
  truck: { hoodX: 0.36, windshieldX: 0.16 },
};

interface Props {
  bodyType: Exclude<BodyType, "motorcycle">;
  color: string;
  licensePlate?: string | null;
  /** Zones with an overdue service — hit-boxes glow/pulse red. */
  dueZones?: Zone[];
  onZoneClick?: (zone: Zone) => void;
  hoveredZone?: Zone | null;
  setHoveredZone?: (zone: Zone | null) => void;
}

interface Prepared {
  object: THREE.Group;
  size: THREE.Vector3; // bbox size after normalization (x = length)
  wheelPositions: THREE.Vector3[];
  plateAnchors: { rear: PlateAnchor | null; front: PlateAnchor | null };
}

function prepareVehicle(
  scene: THREE.Group,
  bodyType: Props["bodyType"],
  color: string
): Prepared {
  scene.updateMatrixWorld(true);
  const name = NODE_NAMES[bodyType];

  // The pack stores wheels as SIBLINGS of the vehicle body node
  // ("Pickup wheel front left" next to "Pickup"), so gather body + wheels.
  // GLTFLoader sanitizes node names (spaces → underscores), so normalize.
  const wheelRe = new RegExp(`^${name} wheel (front|rear) (left|right)$`, "i");
  const norm = (s: string) => s.replace(/_/g, " ");
  const parts: THREE.Object3D[] = [];
  scene.traverse((n) => {
    if (norm(n.name) === name || wheelRe.test(norm(n.name))) parts.push(n);
  });
  if (!parts.length) throw new Error(`Vehicle node ${name} not found in pack`);

  // Clone each part with its full world transform baked (Sketchfab FBX roots
  // carry rotation/scale on ancestors).
  const object = new THREE.Group();
  for (const part of parts) {
    const clone = part.clone(true);
    if (part.parent) clone.applyMatrix4(part.parent.matrixWorld);
    object.add(clone);
  }

  // Pick the paint target: the "body ..." material (any shade except black)
  // covering the most geometry — vehicles differ in what their main color is
  // (the Sedan's factory paint is literally "body white").
  const areaByMaterial = new Map<string, number>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      const n = (m.name || "").toLowerCase().replace(/_/g, " ");
      if (n.startsWith("body") && n !== "body black") {
        const count = child.geometry?.attributes?.position?.count ?? 0;
        areaByMaterial.set(n, (areaByMaterial.get(n) ?? 0) + count);
      }
    }
  });
  const paintTarget = [...areaByMaterial.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // Retint body + restyle glass; clone materials so vehicles don't share tints.
  const bodyColor = new THREE.Color(color);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const mapped = mats.map((m) => {
      const matName = (m.name || "").toLowerCase().replace(/_/g, " ");
      if (matName === paintTarget) {
        return new THREE.MeshPhysicalMaterial({
          name: "body_tinted",
          color: bodyColor,
          metalness: 0.75,
          roughness: 0.32,
          clearcoat: 1,
          clearcoatRoughness: 0.15,
        });
      }
      if (matName.includes("window")) {
        return new THREE.MeshPhysicalMaterial({
          name: "glass_tinted",
          color: new THREE.Color("#22303a"),
          metalness: 0.2,
          roughness: 0.08,
          transparent: true,
          opacity: 0.92,
        });
      }
      if (matName.includes("headlight")) {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.emissive = new THREE.Color("#ffedb0");
        c.emissiveIntensity = 0.9;
        return c;
      }
      if (matName.includes("rear light")) {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.emissive = new THREE.Color("#c1170e");
        c.emissiveIntensity = 0.7;
        return c;
      }
      return m;
    });
    child.material = Array.isArray(child.material) ? mapped : mapped[0];
  });

  // Normalize on a clean wrapper hierarchy (never mutate the clone's own
  // transform — it carries the FBX's baked rotations and Euler edits compose
  // unpredictably with them): spin aligns the long axis to X, wrapper scales,
  // grounds, and centers.
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

  // Nose toward +x, decided by where the headlight vs rear-light materials
  // sit. (Wheel node names looked usable but are labeled inconsistently
  // between vehicles in this pack; light materials are reliable.)
  spin.updateMatrixWorld(true);
  let headX = 0, headN = 0, tailX = 0, tailN = 0;
  object.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      const mn = (m.name || "").toLowerCase().replace(/_/g, " ");
      if (!mn.includes("headlight") && !mn.includes("rear light")) continue;
      const cx = new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()).x;
      if (mn.includes("headlight")) { headX += cx; headN++; }
      else { tailX += cx; tailN++; }
    }
  });
  if (headN && tailN && headX / headN < tailX / tailN) {
    spin.rotation.y += Math.PI;
    box = new THREE.Box3().setFromObject(spin);
    sz = box.getSize(new THREE.Vector3());
  }
  const scale = TARGET_LENGTHS[bodyType] / sz.x;
  spin.scale.multiplyScalar(scale);
  box = new THREE.Box3().setFromObject(spin);
  const center = box.getCenter(new THREE.Vector3());
  spin.position.x -= center.x;
  spin.position.z -= center.z;
  spin.position.y -= box.min.y;
  box = new THREE.Box3().setFromObject(spin);
  const size = box.getSize(new THREE.Vector3());

  // Wheel hit-box anchors from the pack's named wheel nodes.
  wrapper.updateMatrixWorld(true);
  const wheelPositions: THREE.Vector3[] = [];
  object.traverse((child) => {
    if (wheelRe.test(norm(child.name))) {
      wheelPositions.push(child.getWorldPosition(new THREE.Vector3()));
    }
  });

  // Plate mounting points: raycast into the body at bumper height (two
  // heights in case the first passes through a gap), else bbox face.
  const plateAt = (fromX: number): PlateAnchor | null =>
    findPlateAnchor(object, { y: size.y * 0.3, fromX }) ??
    findPlateAnchor(object, { y: size.y * 0.4, fromX }) ?? {
      position: new THREE.Vector3(
        Math.sign(fromX) * (size.x / 2),
        size.y * 0.3,
        0
      ),
      normal: new THREE.Vector3(Math.sign(fromX), 0, 0),
    };
  const plateAnchors = { rear: plateAt(-size.x), front: plateAt(size.x) };

  return { object: wrapper, size, wheelPositions, plateAnchors };
}

export default function GlbVehicleModel({
  bodyType,
  color,
  licensePlate,
  dueZones,
  onZoneClick,
  hoveredZone,
  setHoveredZone,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const hitboxMats = useRef(new Map<string, { mat: THREE.MeshBasicMaterial; zone: Zone }>());
  const { scene } = useGLTF(MODEL_URL);

  const { object, size, wheelPositions, plateAnchors } = useMemo(
    () => prepareVehicle(scene, bodyType, color),
    [scene, bodyType, color]
  );

  useFrame(({ clock }, dt) => {
    if (root.current && !hoveredZone) {
      root.current.rotation.y += dt * 0.15;
    }
    // Hit-box opacity every frame: hover glow wins, due zones pulse red.
    const pulse = 0.11 + 0.07 * Math.sin(clock.elapsedTime * 2.5);
    for (const { mat, zone } of hitboxMats.current.values()) {
      const due = dueZones?.includes(zone);
      mat.opacity = hoveredZone === zone ? 0.25 : due ? pulse : 0;
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

  const hitboxMaterial = (zone: Zone, key = zone as string) => (
    <meshBasicMaterial
      ref={(m: THREE.MeshBasicMaterial | null) => {
        if (m) hitboxMats.current.set(key, { mat: m, zone });
        else hitboxMats.current.delete(key);
      }}
      color={dueZones?.includes(zone) ? "#e11d48" : "#ff5722"}
      transparent
      opacity={hoveredZone === zone ? 0.22 : dueZones?.includes(zone) ? 0.14 : 0}
      depthWrite={false}
    />
  );

  const L = size.x, H = size.y, W = size.z;
  const wheelR = wheelPositions.length
    ? Math.max(...wheelPositions.map((p) => p.y))
    : H * 0.18;

  const plateText = licensePlate?.trim();

  return (
    <group ref={root}>
      <primitive object={object} />

      {/* user's license plate, rear + front */}
      {plateText && plateAnchors.rear && (
        <PlateMesh anchor={plateAnchors.rear} text={plateText} width={L * 0.11} />
      )}
      {plateText && plateAnchors.front && (
        <PlateMesh anchor={plateAnchors.front} text={plateText} width={L * 0.11} />
      )}

      {/* HOOD hit-box: front quarter, above beltline */}
      <mesh
        position={[L * ZONE_LAYOUT[bodyType].hoodX, H * 0.55, 0]}
        {...zoneHandlers("hood")}
      >
        <boxGeometry args={[L * 0.3, H * 0.32, W * 0.92]} />
        {hitboxMaterial("hood")}
      </mesh>

      {/* WINDSHIELD hit-box: cabin glass band */}
      <mesh
        position={[L * ZONE_LAYOUT[bodyType].windshieldX, H * 0.78, 0]}
        {...zoneHandlers("windshield")}
      >
        <boxGeometry args={[L * 0.26, H * 0.4, W * 0.96]} />
        {hitboxMaterial("windshield")}
      </mesh>

      {/* WHEEL hit-boxes at each wheel node */}
      {wheelPositions.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} {...zoneHandlers("wheels")}>
          <sphereGeometry args={[wheelR * 1.15, 12, 12]} />
          {hitboxMaterial("wheels", `wheels-${i}`)}
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
