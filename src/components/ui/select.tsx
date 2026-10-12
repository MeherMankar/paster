import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Native select styled as a chip (default) or as a taller settings row for phone sheets. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { look?: "chip" | "row" }>(function Select(
  { className, children, look = "chip", ...props },
  ref,
) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        ref={ref}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-md border border-border text-fg transition-colors hover:border-border-strong focus:border-border-strong disabled:opacity-50",
          look === "row" ? "h-11 bg-bg pl-3 pr-9 text-[16px]" : "h-8 bg-surface pl-2.5 pr-7 text-[13px]",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-faint", look === "row" ? "right-3 size-4" : "right-2 size-3.5")} aria-hidden />
    </span>
  );
});
