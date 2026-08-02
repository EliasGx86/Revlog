"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Renders the user's license plate text onto the 3D vehicle. The pack models
// have no dedicated plate mesh (the white details share one "body white"
// material), so we find a mounting surface by raycasting into the body at
// bumper height and orient a small canvas-textured plane to the hit normal —
// which also handles the Harley's angled rear fender.

export interface PlateAnchor {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

/** Raycast along X into `object` to find a plate mounting surface. */
export function findPlateAnchor(
  object: THREE.Object3D,
  opts: { y: number; fromX: number }
): PlateAnchor | null {
  const dir = new THREE.Vector3(opts.fromX > 0 ? -1 : 1, 0, 0);
  const caster = new THREE.Raycaster(
    new THREE.Vector3(opts.fromX, opts.y, 0),
    dir
  );
  const hit = caster.intersectObject(object, true)[0];
  if (!hit) return null;
  let normal = hit.face
    ? hit.face.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize()
    : dir.clone().negate();
  // Plate must face back toward the ray origin, and stay roughly upright.
  if (normal.dot(dir) > 0) normal = normal.clone().negate();
  if (Math.abs(normal.y) > 0.85) normal = dir.clone().negate();
  return { position: hit.point.clone(), normal };
}

function makePlateTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Neutral plate blank — deliberately not styled after any real state plate.
  ctx.fillStyle = "#e9eae4";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "#20304d";
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 512 - 28, 256 - 28);

  const label = text.trim().toUpperCase().slice(0, 8);
  ctx.fillStyle = "#20304d";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 150;
  do {
    ctx.font = `bold ${fontSize}px "Arial Narrow", Arial, sans-serif`;
    fontSize -= 10;
  } while (ctx.measureText(label).width > 440 && fontSize > 60);
  ctx.fillText(label, 256, 140);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface PlateMeshProps {
  anchor: PlateAnchor;
  text: string;
  /** Plate width in world units; height is half of it (US 2:1 plates). */
  width: number;
}

export function PlateMesh({ anchor, text, width }: PlateMeshProps) {
  const texture = useMemo(() => makePlateTexture(text), [text]);
  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        anchor.normal
      ),
    [anchor]
  );
  // Generous offset + polygon offset: some models have raised white details
  // (blank plate blocks) right where we mount, which otherwise clip the plate.
  const position = useMemo(
    () => anchor.position.clone().addScaledVector(anchor.normal, 0.045),
    [anchor]
  );

  return (
    <mesh position={position} quaternion={quaternion}>
      <planeGeometry args={[width, width / 2]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.6}
        metalness={0.1}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}
