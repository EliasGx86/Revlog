import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// Dev-only: the /dev/models page POSTs canvas screenshots here so model
// changes can be reviewed as image files (.dev-snapshots/, gitignored).
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { name, dataUrl } = await req.json();
  if (typeof name !== "string" || typeof dataUrl !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const dir = path.join(process.cwd(), ".dev-snapshots");
  await mkdir(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9_-]/gi, "").slice(0, 60) || "snapshot";
  await writeFile(path.join(dir, `${safe}.png`), Buffer.from(b64, "base64"));
  return NextResponse.json({ ok: true });
}
