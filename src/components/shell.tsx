import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/config";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocalPastesMenu } from "@/components/local-pastes-menu";
import { cn } from "@/lib/cn";

/**
 * App chrome: a slim top bar and a content slot that fills the viewport.
 * `mobile` picks the phone layout: both modes make the content full-bleed, pad <main> above the
 * page's fixed bottom bar and drop the footer (its links live in the sheets). "editor" is the
 * home page, "viewer" the paste page; other pages keep the desktop shell scaled down.
 */
export function Shell({ children, actions, wide, mobile }: { children: ReactNode; actions?: ReactNode; wide?: boolean; mobile?: "editor" | "viewer" }) {
  const width = wide ? "max-w-[1400px]" : "max-w-6xl";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
        <div className={cn("mx-auto flex h-12 items-center gap-3 px-4", width)}>
          <Link href="/" className="flex items-center gap-2 rounded-md text-[14px] font-semibold tracking-tight text-fg" aria-label={`${SITE.name} home`}>
            <Logo className="size-5" />
            <span>{SITE.name}</span>
          </Link>
          <nav className="ml-1 hidden items-center gap-0.5 sm:flex" aria-label="Primary">
            <Link href="/" className="rounded-md px-2 py-1 text-[13.5px] font-medium text-fg-muted transition-colors hover:text-fg">
              new
            </Link>
            <Link href="/docs" className="rounded-md px-2 py-1 text-[13.5px] font-medium text-fg-muted transition-colors hover:text-fg">
              api &amp; cli
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            <LocalPastesMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={cn("mx-auto flex w-full flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4", width, mobile && "max-sm:px-0 max-sm:py-0 max-sm:pb-bar")}>{children}</main>
      <footer className={cn(mobile ? "max-sm:hidden" : "max-sm:pb-safe")}>
        <div className={cn("mx-auto flex items-center gap-x-4 px-4 py-3 font-mono text-[12px] text-fg-faint", width)}>
          <Link href="/docs" className="transition-colors hover:text-fg">
            api &amp; cli
          </Link>
          <Link href="/docs#security" className="transition-colors hover:text-fg">
            security
          </Link>
          <a href={SITE.repo} className="transition-colors hover:text-fg" rel="noopener noreferrer" target="_blank">
            source
          </a>
          <span className="ml-auto hidden sm:inline">no ads · no accounts · no tracking</span>
        </div>
      </footer>
    </div>
  );
}
