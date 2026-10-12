import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Phone-only action bar pinned to the bottom of the screen (hidden from sm up), the way
 * native apps keep primary actions under the thumb. It is the desktop toolbar stretched
 * across the screen: the same surface, hairline dividers, icon beside a 13px label.
 * Its buttons need JavaScript, so it stays hidden until the theme script marks
 * <html class="js">; pages that render one pad <main> with `pb-bar` so nothing hides behind it.
 */
export function MobileBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 flex divide-x divide-border border-t border-border bg-surface px-inset pb-[var(--safe-b)] sm:hidden [html:not(.js)_&]:hidden"
    >
      {children}
    </nav>
  );
}

const item =
  "flex h-14 min-w-0 flex-1 select-none items-center justify-center gap-1.5 px-1 text-[13px] font-medium text-fg-muted transition-colors active:bg-surface-2 active:text-fg disabled:pointer-events-none disabled:opacity-40 aria-expanded:bg-surface-2 aria-expanded:text-fg aria-pressed:bg-surface-2 aria-pressed:text-fg";

export function BarButton({ icon, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return (
    <button type="button" className={cn(item, className)} {...props}>
      <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

export function BarLink({ icon, children, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { icon: ReactNode }) {
  return (
    <a className={cn(item, className)} {...props}>
      <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
      <span className="truncate">{children}</span>
    </a>
  );
}
