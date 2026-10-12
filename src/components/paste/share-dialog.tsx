"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import QRCode from "qrcode";
import { Dialog } from "@/components/ui/dialog";
import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";

export function ShareDialog({ open, onClose, url, rawUrl, encrypted }: { open: boolean; onClose: () => void; url: string; rawUrl?: string; encrypted: boolean }) {
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 192, color: { dark: "#171717", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, url]);

  const copy = async (text: string, key: string) => {
    if (!(await copyToClipboard(text))) return;
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const embed = `<iframe src="${url.replace(/#.*$/, "")}?embed=1" style="width:100%;height:24rem;border:1px solid #e5e5e5;border-radius:8px"></iframe>`;

  return (
    <Dialog open={open} onClose={onClose} title="Share">
      <div className="flex flex-col gap-4">
        <Row label="Link" value={url} copied={copied === "url"} onCopy={() => copy(url, "url")} />
        {encrypted && (
          <p className="-mt-2 text-[12px] text-fg-muted">
            The part after <span className="font-mono">#</span> is the decryption key. It never reaches the server, so share the full link.
          </p>
        )}
        {!encrypted && rawUrl && <Row label="Raw" value={rawUrl} copied={copied === "raw"} onCopy={() => copy(rawUrl, "raw")} />}
        {!encrypted && rawUrl && <Row label="Embed" value={embed} copied={copied === "embed"} onCopy={() => copy(embed, "embed")} mono className="max-sm:hidden" />}
        {qr && (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code for this paste" width={96} height={96} className="size-24" />
            <p className="text-[12px] text-fg-muted">
              <span className="max-sm:hidden">Scan to open on a phone.</span>
              <span className="sm:hidden">Scan with another phone.</span>
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Row({ label, value, copied, onCopy, mono, className }: { label: string; value: string; copied: boolean; onCopy: () => void; mono?: boolean; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[12px] font-medium text-fg-muted">{label}</span>
      <span className="flex gap-1.5">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={`h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-[13px] max-sm:h-10 max-sm:px-3 ${mono ? "font-mono text-[12px]" : ""}`}
        />
        <Button type="button" size="md" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </Button>
      </span>
    </label>
  );
}
