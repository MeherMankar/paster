"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type TouchEvent } from "react";
import { X } from "lucide-react";
import { SITE } from "@/lib/config";
import { IconButton } from "./button";
import { cn } from "@/lib/cn";

/** Drag distance (px) past which a swipe on the sheet header dismisses it. */
const SWIPE_CLOSE = 80;

/**
 * Modal built on the native <dialog> element. Centred on desktop; on phones it becomes a
 * bottom sheet (full width, rounded top, clear of the home indicator) so it reads as an app
 * surface rather than a shrunken desktop window. On phones the header (grabber + title)
 * can be dragged down to dismiss.
 */
export function Dialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>("[autofocus], [data-autofocus]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // Sheets are often unmounted while open; closing first lets the browser return focus to
  // whatever opened them (layout cleanups run before React detaches the node).
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    if (window.innerWidth >= 640) return;
    drag.current = { y: e.touches[0].clientY, dy: 0 };
    if (ref.current) ref.current.style.transition = "none";
  };
  const onTouchMove = (e: TouchEvent) => {
    const el = ref.current;
    if (!drag.current || !el) return;
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    el.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onTouchEnd = () => {
    const el = ref.current;
    const d = drag.current;
    drag.current = null;
    if (!el || !d) return;
    if (d.dy > SWIPE_CLOSE) {
      el.style.transition = "transform 160ms ease-in";
      el.style.transform = "translateY(100%)";
      setTimeout(onClose, 150);
      return;
    }
    el.style.transition = "transform 200ms var(--ease)";
    el.style.transform = "";
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,28rem)] rounded-xl border border-border bg-surface p-0 text-fg shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "max-sm:mx-0 max-sm:mb-0 max-sm:mt-auto max-sm:max-h-[88dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-xl max-sm:border-x-0 max-sm:border-b-0 max-sm:px-inset",
      )}
    >
      <div className="touch-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border-strong sm:hidden" />
        <div className="flex items-center justify-between border-b border-border px-4 py-3 max-sm:pt-2">
          <h2 id={titleId} className="text-[14px] font-semibold">
            {title}
          </h2>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
      </div>
      <div className={cn("px-4 py-4 max-sm:pb-safe", className)}>{children}</div>
    </dialog>
  );
}

/** A full-width action row for phone sheets: icon, label, optional hint. A link when `href` is set. */
export function SheetAction({
  icon,
  children,
  hint,
  danger,
  href,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  hint?: string;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = cn(
    "flex min-h-12 w-full items-center gap-3 py-2 text-left text-[14px] font-medium transition-colors active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40",
    danger ? "text-danger" : "text-fg",
  );
  const body = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center text-fg-muted [&>svg]:size-4">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span>{children}</span>
        {hint && <span className="text-[12.5px] font-normal text-fg-muted">{hint}</span>}
      </span>
    </>
  );
  if (href)
    return (
      <a href={href} onClick={onClick} className={cls}>
        {body}
      </a>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  );
}

/** The site footer links, for phone sheets (the footer itself is hidden under the bottom bar). */
export function SheetLinks() {
  return (
    <div className="mt-5 flex justify-center gap-x-5 font-mono text-[12px] text-fg-faint">
      <Link href="/docs" className="hover:text-fg">
        api &amp; cli
      </Link>
      <Link href="/docs#security" className="hover:text-fg">
        security
      </Link>
      <a href={SITE.repo} className="hover:text-fg" rel="noopener noreferrer" target="_blank">
        source
      </a>
    </div>
  );
}
