"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Link2 } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { linkHost } from "@/lib/links";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Preview page for a short link (/{id}+). The bare /{id} redirects straight to the target;
 * this page exists so people can see where a link goes before following it.
 */
export function ShortLinkPanel({ link, shortUrl, views }: { link: string; shortUrl: string; views: number }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!(await copyToClipboard(shortUrl))) return push("error", "Copy failed — select the link and copy it manually");
    setCopied(true);
    push("success", "Short link copied");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-1 flex-col gap-5 rounded-lg border border-border bg-surface px-6 py-8 max-sm:rounded-none max-sm:border-x-0 max-sm:px-4 sm:px-10">
      <div className="flex items-center gap-2 font-mono text-[12px] text-fg-faint">
        <Link2 className="size-3.5" aria-hidden /> short link · {views.toLocaleString("en-US")} {views === 1 ? "visit" : "visits"}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-fg-muted">goes to</span>
        <a href={link} rel="noopener noreferrer nofollow" className="break-all font-mono text-[16px] font-medium text-fg hover:text-accent">
          {link}
        </a>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-fg-muted">short link</span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-sm border border-border bg-bg px-2.5 py-1.5 font-mono text-[14px]">{shortUrl}</code>
          <Button size="md" onClick={copy} aria-label="Copy short link">
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} Copy
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <a href={link} rel="noopener noreferrer nofollow" className={buttonClass("primary")}>
          Open {linkHost(link)} <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
        <span className="text-[12.5px] text-fg-muted">Anyone opening the short link is sent straight there. Add <span className="font-mono">+</span> to the end to see this page first.</span>
      </div>
    </div>
  );
}
