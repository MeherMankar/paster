#!/usr/bin/env python3
"""Regenerate src/lib/grammars.ts from the shiki ids in src/lib/langs.ts."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'src/lib/langs.ts').read_text()
ids = sorted(set(re.findall(r'shiki: "([^"]+)"', src)))
out = ['/* AUTO-GENERATED from langs.ts — run `pnpm gen:grammars` after editing the registry. */',
       'import type { LanguageRegistration } from "@shikijs/core";', '',
       'type Loader = () => Promise<{ default: LanguageRegistration[] }>;', '',
       'export const GRAMMARS: Record<string, Loader> = {']
out += [f'  "{i}": () => import("@shikijs/langs/{i}"),' for i in ids]
out += ['};', '']
(root / 'src/lib/grammars.ts').write_text('\n'.join(out))
print(f'wrote {len(ids)} grammar loaders')
