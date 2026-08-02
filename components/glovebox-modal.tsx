"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent } from "@/components/posthog-provider";

// Glovebox: per-vehicle document storage (receipts, registration, manuals)
// in preset folders. Files live in the private "glovebox" bucket under
// <user_id>/<vehicle_id>/<folder-slug>/<timestamp>_<filename>.

export const FOLDERS = [
  { slug: "maintenance", label: "Maintenance receipts" },
  { slug: "insurance", label: "Insurance & registration" },
  { slug: "title", label: "Title & purchase" },
  { slug: "manuals", label: "Warranty & manuals" },
  { slug: "other", label: "Other" },
] as const;

interface DocumentRow {
  id: string;
  folder: string;
  name: string;
  storage_path: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface Props {
  vehicleId: string;
  onClose: () => void;
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GloveboxModal({ vehicleId, onClose }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [folder, setFolder] = useState<string>(FOLDERS[0].slug);
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, folder, name, storage_path, mime, size_bytes, created_at")
      .eq("vehicle_id", vehicleId)
      .eq("folder", folder)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>();
    setDocs(data ?? []);
  }, [supabase, vehicleId, folder]);

  useEffect(() => {
    setDocs(null);
    refresh();
  }, [refresh]);

  async function upload(file: File) {
    setErr(null);
    setBusy("upload");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const safeName = file.name.replace(/[^\w.\- ]/g, "_");
      const path = `${user.id}/${vehicleId}/${folder}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("glovebox")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { error: rowErr } = await supabase.from("documents").insert({
        user_id: user.id,
        vehicle_id: vehicleId,
        folder,
        name: file.name,
        storage_path: path,
        mime: file.type || null,
        size_bytes: file.size,
      });
      if (rowErr) throw rowErr;
      trackEvent("glovebox_upload", { folder });
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function open(doc: DocumentRow) {
    setErr(null);
    const { data, error } = await supabase.storage
      .from("glovebox")
      .createSignedUrl(doc.storage_path, 120);
    if (error || !data?.signedUrl) {
      setErr("Couldn't open the file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(doc: DocumentRow) {
    if (!confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    setBusy(doc.id);
    try {
      const { error: sErr } = await supabase.storage.from("glovebox").remove([doc.storage_path]);
      if (sErr) throw sErr;
      const { error: dErr } = await supabase.from("documents").delete().eq("id", doc.id);
      if (dErr) throw dErr;
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Glovebox</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Receipts and documents for this vehicle, organized by folder. 10&nbsp;MB max per file.
        </p>

        {/* folder tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FOLDERS.map((f) => (
            <button
              key={f.slug}
              onClick={() => setFolder(f.slug)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                folder === f.slug
                  ? "border-accent bg-accent/10 text-white"
                  : "border-border bg-bg/60 text-muted hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* upload */}
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy === "upload"}
            className="w-full rounded-md border border-dashed border-border bg-bg/40 px-3 py-2.5 text-sm text-muted transition hover:border-accent hover:text-white disabled:opacity-50"
          >
            {busy === "upload" ? "Uploading…" : "+ Upload a photo or PDF"}
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        {/* file list */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {docs === null && <p className="text-sm text-muted">Loading…</p>}
          {docs && docs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              Nothing here yet — snap a photo of a receipt or upload a PDF.
            </p>
          )}
          {docs && docs.length > 0 && (
            <ul className="space-y-1.5">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg/60 px-3 py-2"
                >
                  <span className="text-base">
                    {d.mime === "application/pdf" ? "📄" : "🧾"}
                  </span>
                  <button
                    onClick={() => open(d)}
                    className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                    title="Open"
                  >
                    {d.name}
                  </button>
                  <span className="shrink-0 text-xs text-muted">
                    {fmtSize(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => remove(d)}
                    disabled={busy === d.id}
                    className="shrink-0 text-xs text-muted hover:text-red-400 disabled:opacity-50"
                    aria-label={`Delete ${d.name}`}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
