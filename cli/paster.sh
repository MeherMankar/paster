#!/bin/sh
# paster — paste from the terminal (POSIX sh + curl, no other dependencies).
# Installed by: curl -fsSL https://__HOST__/install.sh | sh
# Usage:
#   ls | paster                 paste stdin
#   paster file.go [file2 …]    paste files (language from the extension)
#   paster clip                 paste the clipboard
#   paster text "some words"    paste literal text
#   paster get <id|url>         print a paste
#   paster rm <id> <token>      delete a paste
# Options (before or after the command):
#   -e|--expires 10m|1h|1d|7d|30d|never   -b|--burn   -t|--title <t>   -l|--lang <id>
#   -c|--copy (copy URL to clipboard)     -o|--open   -r|--raw (print raw URL)   -H|--host <url>
# Encryption needs the Node version: npm i -g paster-cli
set -eu

HOST="${PASTER_HOST:-${PASTR_HOST:-__HOST__}}"
EXPIRES="" BURN="false" TITLE="" LANG_ID="" COPY=0 OPEN=0 RAW=0
CMD="" ; ARGS=""

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
die() { printf 'paster: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }
need curl

while [ $# -gt 0 ]; do
  case "$1" in
    -e|--expires) EXPIRES="$2"; shift 2 ;;
    -b|--burn) BURN="true"; shift ;;
    -t|--title) TITLE="$2"; shift 2 ;;
    -l|--lang) LANG_ID="$2"; shift 2 ;;
    -c|--copy) COPY=1; shift ;;
    -o|--open) OPEN=1; shift ;;
    -r|--raw) RAW=1; shift ;;
    -H|--host) HOST="$2"; shift 2 ;;
    -h|--help) usage ;;
    -v|--version) echo "paster.sh 0.1.0"; exit 0 ;;
    --) shift; break ;;
    -*) die "unknown option $1" ;;
    *) if [ -z "$CMD" ]; then CMD="$1"; else ARGS="$ARGS
$1"; fi; shift ;;
  esac
done
HOST="${HOST%/}"

# Percent-encode every byte (always valid, if a little verbose).
urlencode() { printf '%s' "$1" | od -An -tx1 -v | tr -d ' \n' | sed 's/../%&/g'; }

clip_read() {
  if command -v pbpaste >/dev/null 2>&1; then pbpaste
  elif [ -n "${WAYLAND_DISPLAY:-}" ] && command -v wl-paste >/dev/null 2>&1; then wl-paste --no-newline
  elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard -o
  elif command -v xsel >/dev/null 2>&1; then xsel --clipboard --output
  elif command -v powershell.exe >/dev/null 2>&1; then powershell.exe -NoProfile -Command Get-Clipboard -Raw
  else die "no clipboard tool found (pbpaste, wl-paste, xclip, xsel)"; fi
}
clip_write() {
  if command -v pbcopy >/dev/null 2>&1; then pbcopy
  elif [ -n "${WAYLAND_DISPLAY:-}" ] && command -v wl-copy >/dev/null 2>&1; then wl-copy
  elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard
  elif command -v xsel >/dev/null 2>&1; then xsel --clipboard --input
  elif command -v clip.exe >/dev/null 2>&1; then clip.exe
  else return 1; fi
}
open_url() { (command -v open >/dev/null 2>&1 && open "$1") || (command -v xdg-open >/dev/null 2>&1 && xdg-open "$1") || true; }

# post <name> : reads the body from stdin, prints the URL
post() {
  q="burn=$BURN"
  [ -n "$EXPIRES" ] && q="$q&expires=$(urlencode "$EXPIRES")"
  [ -n "$TITLE" ] && q="$q&title=$(urlencode "$TITLE")"
  [ -n "$LANG_ID" ] && q="$q&lang=$(urlencode "$LANG_ID")"
  [ -n "$1" ] && q="$q&name=$(urlencode "$1")"
  out=$(curl -sS --data-binary @- -H 'Content-Type: text/plain' -H 'Accept: text/plain' -w '\n%{http_code}' "$HOST/api/v1/pastes?$q") || die "could not reach $HOST"
  code=$(printf '%s' "$out" | tail -n 1)
  res=$(printf '%s' "$out" | sed '$d')
  [ "$code" = 201 ] || die "$res"
  [ "$RAW" = 1 ] && res="$(printf '%s' "$res" | sed 's/\.[A-Za-z0-9-]*$//')/raw"
  printf '%s\n' "$res"
  [ "$COPY" = 1 ] && printf '%s' "$res" | clip_write && echo "copied to clipboard" >&2
  [ "$OPEN" = 1 ] && open_url "$res"
  return 0
}

case "$CMD" in
  clip) clip_read | post "" ;;
  text) [ -n "$ARGS" ] || die "usage: text <words>"; printf '%s' "$(printf '%s' "$ARGS" | sed '1d' | tr '\n' ' ')" | post "" ;;
  get)
    ref=$(printf '%s' "$ARGS" | sed -n 2p); [ -n "$ref" ] || die "usage: get <id|url>"
    case "$ref" in
      http*) id=$(printf '%s' "$ref" | sed 's#^https\{0,1\}://[^/]*/##; s#/.*##; s/[.#].*//') ; base=$(printf '%s' "$ref" | sed 's#\(https\{0,1\}://[^/]*\).*#\1#') ;;
      *) id="$ref"; base="$HOST" ;;
    esac
    curl -sS -f "$base/$id/raw" || die "not found" ;;
  rm)
    id=$(printf '%s' "$ARGS" | sed -n 2p); tok=$(printf '%s' "$ARGS" | sed -n 3p)
    [ -n "$id" ] && [ -n "$tok" ] || die "usage: rm <id> <edit-token>"
    curl -sS -f -X DELETE -H "Authorization: Bearer $tok" "$HOST/api/v1/pastes/$id" && echo "deleted $id" ;;
  "") post "" ;;
  *)
    # One file per line (names with spaces are fine).
    { printf '%s\n' "$CMD"; printf '%s\n' "$ARGS" | sed '1d'; } | while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ -f "$f" ] || { printf 'paster: no such file: %s\n' "$f" >&2; exit 1; }
      post "$(basename "$f")" < "$f"
    done ;;
esac
