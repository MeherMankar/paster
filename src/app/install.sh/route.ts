import { originFrom } from "@/lib/url";
import { text } from "@/lib/http";

export const runtime = "nodejs";

/**
 * `curl -fsSL https://host/install.sh | sh` — installs the shell CLI into ~/.local/bin
 * with this instance's URL baked in as the default host.
 */
export async function GET(req: Request) {
  const origin = originFrom(req);
  const script = `#!/bin/sh
# paster installer — puts the \`paster\` shell CLI in ~/.local/bin (override with PASTER_BIN_DIR).
set -eu
DIR="\${PASTER_BIN_DIR:-\${PASTR_BIN_DIR:-$HOME/.local/bin}}"
mkdir -p "$DIR"
curl -fsSL "${origin}/paster.sh" -o "$DIR/paster"
chmod +x "$DIR/paster"
echo "installed $DIR/paster (host: ${origin})"
case ":$PATH:" in
  *":$DIR:"*) ;;
  *) echo "add it to your PATH:  export PATH=\\"$DIR:\\$PATH\\"" ;;
esac
echo "try:  echo hello | paster"
`;
  return text(script, { headers: { "Cache-Control": "public, max-age=300", "Content-Type": "text/x-shellscript; charset=utf-8" } });
}
