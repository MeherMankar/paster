"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The chip itself: icon plus a short label, filled when on. Shared by both appearances so phones and desktop match. */
const chip = (checked: boolean, className?: string) =>
  cn(
    "inline-flex h-8 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150",
    checked ? "border-fg bg-fg text-bg" : "border-border bg-surface text-fg-muted",
    className,
  );

/**
 * A toggle that reads as a chip: icon plus a short visible label, filled when on.
 * `label` is the accessible name (kept stable for tests); `children` is what people see.
 * As a row (phone sheets) the chip sits at the end of a full-width settings line whose
 * visible `rowLabel` names the switch and whose `hint` describes it; the chip is the same
 * chip as on desktop, so both layouts share one look.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
  className,
  children,
  appearance = "chip",
  rowLabel,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  children?: ReactNode;
  appearance?: "chip" | "row";
  rowLabel?: ReactNode;
  hint?: string;
}) {
  const hintId = useId();
  const shared = { id, type: "button" as const, role: "switch", "aria-checked": checked, disabled, onClick: () => onChange(!checked) };
  if (appearance === "row") {
    return (
      <button
        {...shared}
        aria-describedby={hint ? hintId : undefined}
        className={cn("flex w-full items-center justify-between gap-4 py-3 text-left transition-colors active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-fg">{rowLabel ?? label}</span>
          {hint && (
            <span id={hintId} className="text-[12.5px] text-fg-muted">
              {hint}
            </span>
          )}
        </span>
        <span aria-hidden className={chip(checked)}>
          {children}
        </span>
      </button>
    );
  }
  return (
    <button {...shared} aria-label={label} title={label} className={cn(chip(checked, "hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"), className)}>
      {children}
    </button>
  );
}
