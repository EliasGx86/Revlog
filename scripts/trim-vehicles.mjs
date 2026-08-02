// Strip unused vehicles from the RgsDev pack GLB. We render only Sedan, SUV,
// and Pickup (plus their wheel nodes, which are SIBLINGS of the body nodes).
// No dedup/palette passes: the app keys off node and material names.
//
// Usage: node scripts/trim-vehicles.mjs
import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";

const SRC = "public/models/vehicles.glb";
const OUT = "public/models/vehicles.trimmed.glb";
const KEEP = new Set(["Sedan", "SUV", "Pickup"]);

const io = new NodeIO();
const doc = await io.read(SRC);
const nodes = doc.getRoot().listNodes();
const names = nodes.map((n) => n.getName());

// A "vehicle base" is any node that has sibling wheel nodes named
// "<base> wheel front left" etc. Exact prefix match with the " wheel "
// separator keeps "Sedan" from ever matching "Police Sedan".
const baseNames = new Set(
  names.filter((nm) => names.some((o) => o.startsWith(nm + " wheel ")))
);

let removed = 0;
for (const node of nodes) {
  const nm = node.getName();
  // Optional trailing number: dually/trailer wheels are "... wheel rear left 2".
  const wheel = nm.match(/^(.+) wheel (front|rear) (left|right)( \d+)?$/);
  const base = wheel ? wheel[1] : baseNames.has(nm) ? nm : null;
  if (base && !KEEP.has(base)) {
    node.dispose();
    removed++;
  }
}

await doc.transform(prune());
await io.write(OUT, doc);

const kept = doc.getRoot().listNodes().map((n) => n.getName());
console.log(`removed ${removed} nodes; remaining vehicle nodes:`);
console.log(kept.filter((n) => / wheel |^(Sedan|SUV|Pickup)$/.test(n)).join("\n"));
console.log(`materials: ${doc.getRoot().listMaterials().map((m) => m.getName()).join(", ")}`);
