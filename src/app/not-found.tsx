import Link from "next/link";
import { Shell } from "@/components/shell";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="font-mono text-[12px] text-fg-faint">404</p>
        <h1 className="text-[18px] font-semibold tracking-tight">Nothing here</h1>
        <p className="max-w-sm text-[13px] text-fg-muted">This paste doesn&apos;t exist, has expired, was deleted, or was a burn-after-read paste that someone already opened.</p>
        <Link href="/" className={buttonClass("primary", "md", "mt-3")}>
          New paste
        </Link>
      </div>
    </Shell>
  );
}
