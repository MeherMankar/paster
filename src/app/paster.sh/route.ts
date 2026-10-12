import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { originFrom } from "@/lib/url";
import { text } from "@/lib/http";

export const runtime = "nodejs";

/** The POSIX shell CLI with this instance's origin baked in as the default host. */
export async function GET(req: Request) {
  const origin = originFrom(req);
  const script = await readFile(join(process.cwd(), "cli", "paster.sh"), "utf8");
  return text(script.replaceAll("__HOST__", origin), {
    headers: { "Cache-Control": "public, max-age=300", "Content-Type": "text/x-shellscript; charset=utf-8" },
  });
}
