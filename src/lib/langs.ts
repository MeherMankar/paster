/**
 * Language registry. Keep this list curated: every entry maps to a shiki grammar
 * that is loaded lazily on the server, so adding one costs nothing at startup.
 */
export type Lang = {
  id: string;
  label: string;
  /** file extensions (without dot) used for downloads and auto-detection from filenames */
  ext: string[];
  /** aliases accepted from the API / URL suffix */
  aliases?: string[];
  /** shiki grammar id; omitted for plain text / markdown-preview-only */
  shiki?: string;
  /** Set for image "languages": the content is base64 of a file with this media type. */
  mime?: string;
};

export const LANGS: Lang[] = [
  { id: "text", label: "Plain text", ext: ["txt"], aliases: ["plain", "plaintext", "txt"] },
  { id: "markdown", label: "Markdown", ext: ["md"], aliases: ["md"], shiki: "markdown" },
  { id: "javascript", label: "JavaScript", ext: ["js", "mjs", "cjs"], aliases: ["js"], shiki: "javascript" },
  { id: "typescript", label: "TypeScript", ext: ["ts", "mts", "cts"], aliases: ["ts"], shiki: "typescript" },
  { id: "jsx", label: "JSX", ext: ["jsx"], shiki: "jsx" },
  { id: "tsx", label: "TSX", ext: ["tsx"], shiki: "tsx" },
  { id: "json", label: "JSON", ext: ["json"], shiki: "json" },
  { id: "jsonc", label: "JSON with comments", ext: ["jsonc"], shiki: "jsonc" },
  { id: "yaml", label: "YAML", ext: ["yml", "yaml"], aliases: ["yml"], shiki: "yaml" },
  { id: "toml", label: "TOML", ext: ["toml"], shiki: "toml" },
  { id: "html", label: "HTML", ext: ["html", "htm"], shiki: "html" },
  { id: "css", label: "CSS", ext: ["css"], shiki: "css" },
  { id: "scss", label: "SCSS", ext: ["scss"], shiki: "scss" },
  { id: "vue", label: "Vue", ext: ["vue"], shiki: "vue" },
  { id: "svelte", label: "Svelte", ext: ["svelte"], shiki: "svelte" },
  { id: "python", label: "Python", ext: ["py"], aliases: ["py"], shiki: "python" },
  { id: "go", label: "Go", ext: ["go"], aliases: ["golang"], shiki: "go" },
  { id: "rust", label: "Rust", ext: ["rs"], aliases: ["rs"], shiki: "rust" },
  { id: "java", label: "Java", ext: ["java"], shiki: "java" },
  { id: "kotlin", label: "Kotlin", ext: ["kt", "kts"], aliases: ["kt"], shiki: "kotlin" },
  { id: "swift", label: "Swift", ext: ["swift"], shiki: "swift" },
  { id: "c", label: "C", ext: ["c", "h"], shiki: "c" },
  { id: "cpp", label: "C++", ext: ["cpp", "cc", "cxx", "hpp", "hh"], aliases: ["c++", "cxx"], shiki: "cpp" },
  { id: "csharp", label: "C#", ext: ["cs"], aliases: ["cs", "c#"], shiki: "csharp" },
  { id: "php", label: "PHP", ext: ["php"], shiki: "php" },
  { id: "ruby", label: "Ruby", ext: ["rb"], aliases: ["rb"], shiki: "ruby" },
  { id: "dart", label: "Dart", ext: ["dart"], shiki: "dart" },
  { id: "scala", label: "Scala", ext: ["scala"], shiki: "scala" },
  { id: "haskell", label: "Haskell", ext: ["hs"], aliases: ["hs"], shiki: "haskell" },
  { id: "elixir", label: "Elixir", ext: ["ex", "exs"], shiki: "elixir" },
  { id: "erlang", label: "Erlang", ext: ["erl"], shiki: "erlang" },
  { id: "clojure", label: "Clojure", ext: ["clj", "cljs"], shiki: "clojure" },
  { id: "lua", label: "Lua", ext: ["lua"], shiki: "lua" },
  { id: "perl", label: "Perl", ext: ["pl", "pm"], shiki: "perl" },
  { id: "r", label: "R", ext: ["r"], shiki: "r" },
  { id: "julia", label: "Julia", ext: ["jl"], shiki: "julia" },
  { id: "zig", label: "Zig", ext: ["zig"], shiki: "zig" },
  { id: "nim", label: "Nim", ext: ["nim"], shiki: "nim" },
  { id: "ocaml", label: "OCaml", ext: ["ml", "mli"], shiki: "ocaml" },
  { id: "fsharp", label: "F#", ext: ["fs", "fsx"], aliases: ["f#"], shiki: "fsharp" },
  { id: "objective-c", label: "Objective-C", ext: ["m", "mm"], aliases: ["objc"], shiki: "objective-c" },
  { id: "shellscript", label: "Shell", ext: ["sh", "bash", "zsh"], aliases: ["sh", "bash", "zsh", "shell"], shiki: "shellscript" },
  { id: "powershell", label: "PowerShell", ext: ["ps1"], aliases: ["ps", "ps1"], shiki: "powershell" },
  { id: "bat", label: "Batch", ext: ["bat", "cmd"], aliases: ["cmd"], shiki: "bat" },
  { id: "fish", label: "Fish", ext: ["fish"], shiki: "fish" },
  { id: "nix", label: "Nix", ext: ["nix"], shiki: "nix" },
  { id: "dockerfile", label: "Dockerfile", ext: ["dockerfile"], aliases: ["docker"], shiki: "dockerfile" },
  { id: "makefile", label: "Makefile", ext: ["mk"], aliases: ["make"], shiki: "makefile" },
  { id: "cmake", label: "CMake", ext: ["cmake"], shiki: "cmake" },
  { id: "ini", label: "INI", ext: ["ini", "cfg", "conf"], aliases: ["conf", "cfg"], shiki: "ini" },
  { id: "dotenv", label: "dotenv", ext: ["env"], aliases: ["env"], shiki: "dotenv" },
  { id: "sql", label: "SQL", ext: ["sql"], shiki: "sql" },
  { id: "graphql", label: "GraphQL", ext: ["graphql", "gql"], aliases: ["gql"], shiki: "graphql" },
  { id: "prisma", label: "Prisma", ext: ["prisma"], shiki: "prisma" },
  { id: "proto", label: "Protocol Buffers", ext: ["proto"], aliases: ["protobuf"], shiki: "proto" },
  { id: "xml", label: "XML", ext: ["xml", "svg", "xsl", "plist"], aliases: ["svg"], shiki: "xml" },
  { id: "diff", label: "Diff / Patch", ext: ["diff", "patch"], aliases: ["patch"], shiki: "diff" },
  { id: "log", label: "Log", ext: ["log"], shiki: "log" },
  { id: "csv", label: "CSV", ext: ["csv"], shiki: "csv" },
  { id: "latex", label: "LaTeX", ext: ["tex"], aliases: ["tex"], shiki: "latex" },
  { id: "nginx", label: "Nginx", ext: [], shiki: "nginx" },
  { id: "apache", label: "Apache", ext: ["htaccess"], shiki: "apache" },
  { id: "terraform", label: "Terraform / HCL", ext: ["tf", "hcl"], aliases: ["hcl", "tf"], shiki: "terraform" },
  { id: "hlsl", label: "HLSL", ext: ["hlsl"], shiki: "hlsl" },
  { id: "glsl", label: "GLSL", ext: ["glsl", "vert", "frag"], shiki: "glsl" },
  { id: "wasm", label: "WebAssembly", ext: ["wat", "wasm"], aliases: ["wat"], shiki: "wasm" },
  { id: "asm", label: "Assembly", ext: ["asm", "s"], aliases: ["assembly", "nasm"], shiki: "asm" },
  { id: "solidity", label: "Solidity", ext: ["sol"], aliases: ["sol"], shiki: "solidity" },
  { id: "regexp", label: "RegExp", ext: [], aliases: ["regex"], shiki: "regexp" },
  { id: "http", label: "HTTP", ext: ["http"], shiki: "http" },
  { id: "mermaid", label: "Mermaid", ext: ["mmd"], shiki: "mermaid" },
  { id: "png", label: "PNG image", ext: ["png"], mime: "image/png" },
  { id: "jpeg", label: "JPEG image", ext: ["jpg", "jpeg"], aliases: ["jpg"], mime: "image/jpeg" },
  { id: "gif", label: "GIF image", ext: ["gif"], mime: "image/gif" },
  { id: "webp", label: "WebP image", ext: ["webp"], mime: "image/webp" },
];

const byId = new Map<string, Lang>();
for (const l of LANGS) {
  byId.set(l.id, l);
  for (const a of l.aliases ?? []) byId.set(a, l);
}
const byExt = new Map<string, Lang>();
for (const l of LANGS) for (const e of l.ext) if (!byExt.has(e)) byExt.set(e, l);

export function getLang(idOrAlias: string | undefined | null): Lang | undefined {
  if (!idOrAlias) return undefined;
  return byId.get(idOrAlias.toLowerCase());
}

export function normalizeLang(value: unknown): string {
  if (typeof value !== "string") return "text";
  return getLang(value)?.id ?? "text";
}

export function langFromFilename(name: string): Lang | undefined {
  const lower = name.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return byId.get("dockerfile");
  if (lower === "makefile" || lower === "gnumakefile") return byId.get("makefile");
  if (lower === ".env" || lower.startsWith(".env.")) return byId.get("dotenv");
  const idx = lower.lastIndexOf(".");
  if (idx === -1) return undefined;
  return byExt.get(lower.slice(idx + 1));
}

/** Media type when the language is an image format, else undefined. */
export function imageMime(langId: string | undefined): string | undefined {
  return getLang(langId)?.mime;
}

export function langFromMime(mime: string | undefined): Lang | undefined {
  const m = (mime ?? "").split(";")[0].trim().toLowerCase();
  return m ? LANGS.find((l) => l.mime === m) : undefined;
}

export function extensionFor(langId: string): string {
  return getLang(langId)?.ext[0] ?? "txt";
}

/** Split "/abc123.ts" style paths into { id, lang }. Returns undefined lang when not present. */
export function splitIdAndLang(segment: string): { id: string; lang?: string } {
  const idx = segment.indexOf(".");
  if (idx === -1) return { id: segment };
  return { id: segment.slice(0, idx), lang: segment.slice(idx + 1) };
}
