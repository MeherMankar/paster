import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { NewPaste } from "@/components/editor/new-paste";
import { LIMITS, SITE, allowedExpiries } from "@/lib/config";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function HomePage(props: PageProps<"/">) {
  // Web Share Target (PWA) and plain links can prefill the editor: /?title=…&text=…&url=…
  const q = await props.searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const text = [pick(q.text), pick(q.url)].filter(Boolean).join("\n");
  const shared = text ? { content: text.slice(0, LIMITS.maxBytes), title: pick(q.title).slice(0, 120) || undefined } : undefined;
  return (
    <Shell wide mobile="editor">
      <NewPaste maxBytes={LIMITS.maxBytes} expiries={allowedExpiries()} shared={shared} />
    </Shell>
  );
}
