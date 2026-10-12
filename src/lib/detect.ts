/**
 * Tiny heuristic language detector for the editor's "Auto" mode.
 * It is intentionally conservative: when unsure it returns "text".
 * (highlight.js-style auto-detection was the #1 source of mis-highlighted pastes in pasty.)
 */
export function detectLang(source: string): string {
  const s = source.slice(0, 4000);
  const head = s.trimStart();
  if (!head) return "text";

  if (/^#!.*\b(bash|sh|zsh)\b/.test(head)) return "shellscript";
  if (/^#!.*\bpython/.test(head)) return "python";
  if (/^#!.*\bnode/.test(head)) return "javascript";
  if (/^<\?php/.test(head)) return "php";
  if (/^<!doctype html|^<html[\s>]/i.test(head)) return "html";
  if (/^<\?xml/.test(head) || /^<svg[\s>]/.test(head)) return "xml";
  if (/^(diff --git|--- a\/|\+\+\+ b\/|@@ -\d+)/m.test(head)) return "diff";
  if (/^\s*[\[{]/.test(head)) {
    try {
      JSON.parse(s);
      return "json";
    } catch {
      /* not json */
    }
  }
  if (/^(FROM\s+\S+|ARG\s+\S+)\s*$/m.test(head) && /^(RUN|CMD|COPY|ENTRYPOINT)\b/m.test(s)) return "dockerfile";
  if (/^package\s+\w+\s*$/m.test(head) && /\bfunc\s+\w+\s*\(/.test(s)) return "go";
  if (/\bfn\s+\w+\s*\(.*\)\s*(->\s*[\w<>&\[\]:]+)?\s*\{/.test(s) && /\blet\s+(mut\s+)?\w+/.test(s)) return "rust";
  if (/^\s*(import\s+[\w.]+|from\s+[\w.]+\s+import)\b/m.test(s) && /^\s*def\s+\w+\s*\(/m.test(s)) return "python";
  if (/^\s*def\s+\w+\s*\(.*\)\s*:/m.test(s) || /^\s*class\s+\w+(\(.*\))?\s*:/m.test(s)) return "python";
  if (/^\s*(public|private|protected)\s+(static\s+)?(class|void|int|String)\b/m.test(s) && /System\.out|import java\./.test(s)) return "java";
  if (/^\s*using\s+System\b/m.test(s) || /\bnamespace\s+\w+[\s{]/.test(s) && /\bpublic\s+class\b/.test(s)) return "csharp";
  if (/#include\s*<[\w.]+>/.test(s)) return /\b(std::|cout|template\s*<|class\s+\w+)/.test(s) ? "cpp" : "c";
  if (/^\s*(interface|type)\s+\w+\s*(<.*>)?\s*[={]/m.test(s) || /:\s*(string|number|boolean)\b/.test(s)) {
    return /<\/?[A-Z]\w*|<\/?[a-z]+>/.test(s) && /return\s*\(/.test(s) ? "tsx" : "typescript";
  }
  if (/^\s*(import|export)\s.*from\s+['"]/m.test(s) || /\b(const|let|var)\s+\w+\s*=/.test(s) && /=>|function\s*\w*\s*\(/.test(s)) {
    return /<\/?[A-Z]\w*|className=/.test(s) ? "jsx" : "javascript";
  }
  if (/^\s*(SELECT|INSERT\s+INTO|CREATE\s+TABLE|UPDATE|DELETE\s+FROM|ALTER\s+TABLE)\b/im.test(head)) return "sql";
  if (/^\s*[\w-]+:\s*(\S.*)?$/m.test(head) && /^\s*-\s+\S/m.test(s) && !/[{};]/.test(head)) return "yaml";
  if (/^\s*\[[\w.-]+\]\s*$/m.test(head) && /^\s*[\w.-]+\s*=\s*\S/m.test(s)) return "toml";
  if (/^\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(s.replace(/\n/g, " "))) return "css";
  if (/^\s*#{1,6}\s+\S/m.test(head) || /^\s*```/m.test(s) || /\[.+\]\(.+\)/.test(s)) return "markdown";
  if (/^\s*(\$\s|sudo\s|apt\s|npm\s|pnpm\s|git\s|curl\s)/m.test(head) && /^\s*(export|echo|cd|ls|if \[|fi$|done$)/m.test(s)) return "shellscript";
  return "text";
}
