"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";

export type LineRange = { start: number; end: number } | null;

export function parseLineHash(hash: string): LineRange {
  const m = /^#L(\d+)(?:-L?(\d+))?$/.exec(hash);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function lineHash(r: LineRange): string {
  if (!r) return "";
  return r.start === r.end ? `#L${r.start}` : `#L${r.start}-L${r.end}`;
}

/**
 * Renders pre-highlighted lines with a clickable gutter.
 * Click a number to link to that line; shift-click extends the range. The range is
 * stored in the URL hash (#L10-L20) so links to specific lines work everywhere.
 */
export function CodeBlock({ lines, wrap, className, linkable = true }: { lines: string[]; wrap: boolean; className?: string; linkable?: boolean }) {
  const [range, setRange] = useState<LineRange>(null);

  // Hash-driven selection (initial load or back/forward) scrolls to the line; clicks don't.
  useEffect(() => {
    const read = () => {
      const r = parseLineHash(location.hash);
      setRange(r);
      if (r) requestAnimationFrame(() => document.getElementById(`L${r.start}`)?.scrollIntoView({ block: "center" }));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const onGutterClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, n: number) => {
      e.preventDefault();
      let next: LineRange;
      if (e.shiftKey && range) next = { start: Math.min(range.start, n), end: Math.max(range.end, n) };
      else if (range && range.start === n && range.end === n) next = null;
      else next = { start: n, end: n };
      setRange(next);
      // Encrypted pastes keep their key in the hash; never overwrite it with a line anchor.
      if (linkable) history.replaceState(null, "", `${location.pathname}${location.search}${lineHash(next)}`);
    },
    [range, linkable],
  );

  const width = String(lines.length).length;

  return (
    <div className={cn("code overflow-x-auto rounded-lg border border-border bg-code-bg max-sm:rounded-none max-sm:border-x-0", className)}>
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((html, i) => {
            const n = i + 1;
            const hl = !!range && n >= range.start && n <= range.end;
            return (
              <tr key={n} id={`L${n}`} className={cn(hl && "line-hl")}>
                <td className="w-px select-none whitespace-nowrap border-r border-border bg-surface-2/60 pl-3 pr-3 text-right align-top text-[var(--gutter)]">
                  <a
                    href={`#L${n}`}
                    onClick={(e) => onGutterClick(e, n)}
                    className="block tabular-nums hover:text-fg"
                    style={{ minWidth: `${width}ch` }}
                    aria-label={`Line ${n}`}
                  >
                    {n}
                  </a>
                </td>
                <td
                  className={cn("px-4 align-top", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}
                  dangerouslySetInnerHTML={{ __html: html || "​" }}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
