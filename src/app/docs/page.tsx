import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { DEFAULT_EXPIRY, EXPIRIES, LIMITS, SITE } from "@/lib/config";
import { formatBytes } from "@/lib/bytes";
import { Kbd } from "@/components/ui/kbd";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "API & CLI",
  description: `Use ${SITE.name} from the terminal, scripts, or any HTTP client.`,
  alternates: { canonical: "/docs" },
};

function Code({ children }: { children: string }) {
  return (
    <pre className="code overflow-x-auto rounded-lg border border-border bg-surface px-4 py-3 text-[12.5px] leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-16 text-[16px] font-semibold tracking-tight first:mt-0">
      <a href={`#${id}`} className="hover:underline">
        {children}
      </a>
    </h2>
  );
}

export default async function DocsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const HOST = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `${proto}://${host}`;
  return (
    <Shell>
      <div className="mx-auto w-full max-w-3xl py-10">
        <h1 className="text-[24px] font-semibold tracking-tight">API &amp; CLI</h1>
        <p className="mt-2 text-[14px] text-fg-muted">
          Everything the website does is available over plain HTTP. No keys, no accounts. Responses are JSON unless the client looks like a terminal, in
          which case you get the URL back as text.
        </p>

        <H2 id="cli">Install the CLI</H2>
        <p className="text-[13px] text-fg-muted">
          Paste without opening the site. The Node version supports end-to-end encryption; the shell version needs only <span className="font-mono">curl</span>.
        </p>
        <Code>{`# Node 20+ (clone the repository, then run from its root)
git clone https://github.com/mehermankar/paster.git
cd paster
npm install -g ./cli
paster config host ${HOST}

# No Node? POSIX shell + curl, with this host preconfigured
curl -fsSL ${HOST}/install.sh | sh`}</Code>
        <Code>{`ls -la | paster                  # stdin
paster main.go --expires 1d     # files (language from the extension)
paster clip -E -c               # clipboard → encrypted paste, link copied back
paster text "hello there" -b    # literal text, burn after read
paster get ${HOST}/AbCd1234#key # print (and decrypt) a paste
paster ls                       # browse your pastes: ↑↓ or click, enter reveals the edit token
paster rm AbCd1234              # delete with the locally stored edit token
paster token AbCd1234           # show that token, for the site's Edit/Delete prompt`}</Code>

        <H2 id="quick">Plain curl</H2>
        <Code>{`# Pipe anything in and get a link back
cat main.go | curl --data-binary @- -H 'Content-Type: text/plain' '${HOST}/api/v1/pastes?name=main.go'

# Options travel in the query string for raw bodies (burn accepts true/false, or just ?burn)
curl --data-binary @notes.md -H 'Content-Type: text/plain' '${HOST}/api/v1/pastes?lang=markdown&expires=1d&burn'

# A form works too (curl -F) — the filename picks the language
curl -F 'content=@script.py' -F expires=1h ${HOST}/api/v1/pastes

# Images (png, jpeg, gif, webp, up to ${formatBytes(LIMITS.maxImageBytes)}) go the same way; /raw serves them back with their media type
curl --data-binary @shot.png -H 'Content-Type: image/png' '${HOST}/api/v1/pastes?expires=1d'`}</Code>
        <p className="mt-3 text-[13px] text-fg-muted">
          The edit token is returned in the <span className="font-mono">X-Edit-Token</span> header (and in the JSON body). Keep it if you want to change or delete the paste later.
          Terminal clients (curl, wget, httpie) get the URL back as text and errors as <span className="font-mono">error: message (code)</span>; force a format with <span className="font-mono">Accept: application/json</span>, <span className="font-mono">Accept: text/plain</span>, or <span className="font-mono">?plain</span>.
          Send <span className="font-mono">Content-Type: text/plain</span> for raw bodies so a file that happens to start with <span className="font-mono">content=</span> is not read as a form.
        </p>

        <H2 id="create">Create</H2>
        <Code>{`POST /api/v1/pastes
Content-Type: application/json

{
  "content": "hello",          // required, ≤ ${formatBytes(LIMITS.maxBytes)}
  "title": "hello.txt",        // optional, ≤ ${LIMITS.maxTitle} chars
  "lang": "go",                // optional; id or alias (unknown → "text"; auto-detection is a web-editor feature)
  "expires": "${DEFAULT_EXPIRY}",             // ${EXPIRIES.map((e) => e.id).join(" | ")}
  "burn": false,               // destroy after the first read (true/false, 1/0, yes/no)
  // responses also carry "kind": "text" | "image" | "link" (and "link": the target for short links)
  "enc": { ... }               // present only for client-encrypted pastes, see below
}

201 Created
{
  "id": "k7Pq2Xw9", "url": "${HOST}/k7Pq2Xw9", "rawUrl": "${HOST}/k7Pq2Xw9/raw",
  "editToken": "…",            // shown once, never stored in clear
  "title": "hello.txt", "lang": "go", "created": 1757000000000, "expires": 1757604800000,
  "burn": false, "views": 0, "size": 5
}`}</Code>
        <p className="mt-3 text-[13px] text-fg-muted">
          Bodies may also be <span className="font-mono">multipart/form-data</span>, <span className="font-mono">application/x-www-form-urlencoded</span> or raw text. For raw text, pass options as query parameters (<span className="font-mono">name</span>, <span className="font-mono">lang</span>, <span className="font-mono">expires</span>, <span className="font-mono">burn</span>, <span className="font-mono">title</span>).
          In JSON, an image is its base64 in <span className="font-mono">content</span> with <span className="font-mono">lang</span> set to <span className="font-mono">png</span>, <span className="font-mono">jpeg</span>, <span className="font-mono">gif</span> or <span className="font-mono">webp</span>; raw and multipart bodies with an image content type or file name are converted for you.
        </p>

        <H2 id="links">Short links</H2>
        <p className="text-[13px] text-fg-muted">
          A paste that is exactly one <span className="font-mono">http(s)</span> URL becomes a short link: opening it redirects straight to the target, and the editor tells you so when it sees one. Encrypted and burn-after-read pastes never redirect.
        </p>
        <Code>{`curl --data-binary 'https://example.com/some/very/long/path?with=params' -H 'Content-Type: text/plain' ${HOST}/api/v1/pastes
${HOST}/AbCd1234              → 307 redirect to the target (counts a visit)
${HOST}/AbCd1234+             → preview page: where it goes, visits, QR
GET /api/v1/pastes/AbCd1234   → { "kind": "link", "link": "https://example.com/…", … }`}</Code>

        <H2 id="read">Read</H2>
        <Code>{`GET  /api/v1/pastes/:id         → JSON (counts a view)
GET  /:id/raw                   → text/plain, or the image bytes with their media type (counts a view)
GET  /:id/raw?dl=1              → download with a filename
GET  /:id.go                    → web view highlighted as Go, whatever the stored language
HEAD any of the above           → existence check only: never counts a view, never burns

Every GET that returns content destroys a burn-after-read paste — including /raw, /raw/:key and
/documents/:key. Only the web page (/:id) shows a confirmation first.`}</Code>

        <H2 id="update">Update &amp; delete</H2>
        <Code>{`PATCH  /api/v1/pastes/:id       Authorization: Bearer <editToken>
       { "content": "…", "title": "…", "lang": "…" }   (any subset; expiry is kept; "title": "" clears it)

DELETE /api/v1/pastes/:id       Authorization: Bearer <editToken>   → 204`}</Code>

        <H2 id="encryption">Client-side encryption</H2>
        <p className="text-[13px] text-fg-muted">
          When you turn on <em>Encrypt</em> in the editor, the browser encrypts a JSON envelope <span className="font-mono">{"{title, lang, content}"}</span> with AES-256-GCM and uploads only the ciphertext. In link mode the 256-bit key is appended to the URL after <span className="font-mono">#</span>, which browsers never send to servers. In password mode the key is derived with PBKDF2-SHA256 (600,000 iterations) and a random salt.
        </p>
        <Code>{`{
  "content": "<base64url ciphertext>",
  "enc": { "alg": "AES-GCM", "kdf": "fragment" | "password", "iv": "<base64url>", "salt"?: "<base64url>", "iterations"?: 600000 }
}`}</Code>
        <p className="mt-3 text-[13px] text-fg-muted">
          The server cannot read encrypted pastes, so their title and language are hidden too, and <span className="font-mono">/raw</span> returns the ciphertext with an <span className="font-mono">X-Encrypted: 1</span> header.
        </p>

        <H2 id="hastebin">hastebin compatibility</H2>
        <Code>{`POST /documents            → { "key": "k7Pq2Xw9" }   (30-day expiry)
GET  /documents/:key       → { "data": "…", "key": "…" }
GET  /raw/:key             → text/plain`}</Code>
        <p className="mt-3 text-[13px] text-fg-muted">Point any hastebin client (haste, wgetpaste, editor plugins) at this host and it keeps working.</p>

        <H2 id="limits">Limits &amp; errors</H2>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-fg-muted">
          <li>Content up to {formatBytes(LIMITS.maxBytes)}; images up to {formatBytes(LIMITS.maxImageBytes)} before base64; titles up to {LIMITS.maxTitle} characters.</li>
          <li>Rate limits per IP: 20 creates/min, 120 reads/min, 30 edits or deletes/min, 5 reports/10 min. Over the limit you get 429 with a Retry-After header.</li>
          <li>
            Errors are <span className="font-mono">{'{ "error": { "code", "message" } }'}</span> with the matching HTTP status (400 invalid, 401/403 token problems, 404 missing or expired, 413 too large, 429 rate limited).
          </li>
          <li>Paste pages are never indexed by search engines. Expiry is enforced by the database, not a cron job, so it is exact.</li>
        </ul>

        <H2 id="admin">Operator API</H2>
        <Code>{`# Set ADMIN_TOKEN in the environment, then:
curl -H 'Authorization: Bearer $ADMIN_TOKEN' '${HOST}/api/v1/admin/pastes?limit=50'          # newest first
curl -H 'Authorization: Bearer $ADMIN_TOKEN' '${HOST}/api/v1/admin/pastes?sort=reports'      # most reported
curl -X DELETE -H 'Authorization: Bearer $ADMIN_TOKEN' ${HOST}/api/v1/pastes/AbCd1234        # remove anything`}</Code>
        <p className="mt-3 text-[13px] text-fg-muted">
          Listings never include content. Reports are kept for 30 days with a salted hash of the reporter. Notifications are off by default: set <span className="font-mono">TELEGRAM_BOT_TOKEN</span> and <span className="font-mono">TELEGRAM_CHAT_ID</span> for Telegram messages with Open and Remove buttons (<span className="font-mono">POST /api/v1/admin/telegram</span> registers the button&apos;s webhook if auto-setup didn&apos;t run), or <span className="font-mono">REPORT_WEBHOOK_URL</span> for a Discord-compatible webhook. Set <span className="font-mono">MAX_EXPIRY</span> (for example <span className="font-mono">30d</span>) to cap how long pastes may live.
        </p>

        <H2 id="security">Security model</H2>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-fg-muted">
          <li>
            <strong className="text-fg">Plain pastes</strong> are readable by anyone with the link (and by the operator). Links are unguessable 8-character ids from a 55-symbol alphabet, never indexed, and expire exactly when you said.
          </li>
          <li>
            <strong className="text-fg">Encrypted pastes</strong> are sealed in your browser with AES-256-GCM before upload. In link mode the key lives after <span className="font-mono">#</span>, which browsers never send to servers; in password mode it is derived with PBKDF2-SHA256 (600,000 iterations). The server stores ciphertext, an IV and a salt, and learns only the size. This protects against a database leak or a curious operator. It does <em>not</em> protect against someone who has the full link, a compromised browser or extension, or a malicious copy of this site&apos;s JavaScript — check the source or self-host if that matters to you.
          </li>
          <li>
            <strong className="text-fg">Burn after read</strong> deletes the paste in the same atomic step that reads it, so two readers can never both see it. Link previewers only ever see the confirmation page; <span className="font-mono">HEAD</span> requests are side-effect free.
          </li>
          <li>
            <strong className="text-fg">Edit tokens</strong> are 256-bit random values shown once; only a SHA-256 hash is stored. Your browser keeps them (and link keys) in <span className="font-mono">localStorage</span> for the &ldquo;Your pastes&rdquo; list — export that list if you clear site data.
          </li>
          <li>
            <strong className="text-fg">What the server keeps</strong>: the paste, its metadata (language, size, timestamps, view count), rate-limit counters keyed by IP for a few minutes, and hashed reporter ids on abuse reports. No analytics, no third-party scripts, no SDK telemetry, <span className="font-mono">Referrer-Policy: no-referrer</span>, a nonce-based CSP.
          </li>
          <li>
            <strong className="text-fg">Before you paste a secret</strong>: the editor warns when text looks like a key or password. Prefer encrypt + burn, or better, don&apos;t paste it at all.
          </li>
        </ul>

        <H2 id="info">Capabilities</H2>
        <Code>{`GET /api/v1/info   → { name, version, limits, expiries, defaultExpiry, languages, features, stats }`}</Code>

        <H2 id="shortcuts">Keyboard shortcuts</H2>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
          {[
            ["⌘/Ctrl + S", "Save"],
            ["⌘/Ctrl + ↵", "Save"],
            ["Tab / Shift + Tab", "Indent / outdent"],
            ["Esc", "Cancel editing"],
            ["c", "Copy paste"],
            ["e", "Edit"],
            ["f", "Fork into a new paste"],
            ["w", "Toggle line wrap"],
            ["r", "Open raw"],
            ["n", "New paste"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-fg-muted">{v}</span>
              <Kbd>{k}</Kbd>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
