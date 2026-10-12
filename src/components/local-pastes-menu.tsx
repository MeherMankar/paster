"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, History, Lock, Flame, Trash2, Upload } from "lucide-react";
import { exportLocal, forgetPaste, importLocal } from "@/lib/local";
import { useLocalPastes } from "@/hooks/use-local";
import { useToast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/expiry";
import { getLang } from "@/lib/langs";
import { IconButton } from "@/components/ui/button";

/** "Your pastes": recent pastes from this browser, with their edit tokens kept locally. */
export function LocalPastesMenu() {
  const [open, setOpen] = useState(false);
  const pastes = useLocalPastes();
  const ref = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { push } = useToast();
  const [goto, setGoto] = useState("");

  const openById = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = goto.trim();
    if (!raw) return;
    let target = raw;
    try {
      const u = new URL(raw);
      target = u.pathname.replace(/^\//, "") + u.hash;
    } catch {
      /* plain id */
    }
    setOpen(false);
    setGoto("");
    router.push(`/${target}`);
  };

  const doExport = () => {
    const blob = new Blob([exportLocal()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "paster-history.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const doImport = async (file: File) => {
    try {
      const n = importLocal(await file.text());
      push("success", `Imported ${n} paste${n === 1 ? "" : "s"}`);
    } catch {
      push("error", "That file isn't a paster history export");
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label="Your pastes" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="your-pastes">
        <History className="size-4" />
        {pastes.length > 0 && <span className="sr-only">{pastes.length} saved</span>}
      </IconButton>
      {open && (
        <div
          id="your-pastes"
          role="region"
          aria-label="Your pastes"
          onBlur={(e) => {
            // Keyboard users tabbing out close it; taps on Safari blur with no relatedTarget, so leave those to the outside-click handler.
            if (e.relatedTarget && !ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
          }}
          className="animate-fade-up absolute right-0 top-full mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-pop max-sm:fixed max-sm:inset-x-0 max-sm:top-12 max-sm:mt-0 max-sm:w-auto max-sm:rounded-none max-sm:border-x-0"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 max-sm:px-4">
            <span className="text-[12px] font-medium text-fg-muted">Your pastes</span>
            <span className="font-mono text-[11px] text-fg-faint">this browser only</span>
          </div>
          <form onSubmit={openById} className="flex gap-1.5 border-b border-border px-3 py-2 max-sm:px-4">
            <input
              value={goto}
              onChange={(e) => setGoto(e.target.value)}
              placeholder="Open a paste id or link"
              aria-label="Open a paste by id or link"
              className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-bg px-2 font-mono text-[12px] max-sm:h-10 max-sm:rounded-md max-sm:px-3"
            />
            <button type="submit" className="rounded-sm border border-border px-2 text-[12px] text-fg-muted hover:border-accent hover:text-fg max-sm:h-10 max-sm:rounded-md max-sm:px-3.5 max-sm:text-[14px]">
              Open
            </button>
          </form>
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 text-[11.5px] text-fg-faint max-sm:px-3 max-sm:text-[13px]">
            <button type="button" onClick={doExport} disabled={pastes.length === 0} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-2 hover:text-fg disabled:opacity-50 max-sm:h-10 max-sm:rounded-md max-sm:px-2.5">
              <Download className="size-3 max-sm:size-4" /> Export
            </button>
            <button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-2 hover:text-fg max-sm:h-10 max-sm:rounded-md max-sm:px-2.5">
              <Upload className="size-3 max-sm:size-4" /> Import
            </button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
            <span className="ml-auto max-sm:hidden">edit tokens &amp; keys included</span>
          </div>
          {pastes.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-fg-faint">Pastes you create will show up here.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1 max-sm:max-h-[50dvh]">
              {pastes.map((p) => (
                <li key={p.id} className="group flex items-center gap-2 px-2 py-1 max-sm:px-3 max-sm:py-1.5">
                  <Link
                    href={`/${p.id}${p.key ? `#${p.key}` : ""}`}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 flex-col rounded-md px-1.5 py-1 hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-1.5 truncate text-[13px]">
                      {p.encrypted && <Lock className="size-3 shrink-0 text-fg-faint" aria-label="encrypted" />}
                      {p.burn && <Flame className="size-3 shrink-0 text-warning" aria-label="burn after read" />}
                      <span className="truncate">{p.title || <span className="font-mono text-fg-muted">{p.id}</span>}</span>
                    </span>
                    <span className="truncate text-[11px] text-fg-faint">
                      {p.lang !== "text" ? `${getLang(p.lang)?.label ?? p.lang} · ` : ""}
                      {formatRelative(p.created)}
                      {p.expires ? ` · expires ${formatRelative(p.expires)}` : ""}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Forget this paste"
                    title="Forget (removes from this list only)"
                    onClick={() => forgetPaste(p.id)}
                    className="rounded-md p-1 text-fg-faint opacity-0 hover:bg-surface-2 hover:text-danger group-hover:opacity-100 focus:opacity-100 max-sm:p-3 max-sm:opacity-100"
                  >
                    <Trash2 className="size-3.5 max-sm:size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
