/**
 * Conservative detectors for credentials people paste by accident.
 * Runs only in the browser on the paste text; nothing is sent anywhere.
 */
const PATTERNS: Array<[string, RegExp]> = [
  ["a private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ["an AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["a GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["a Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["a Stripe key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["a Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["an OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ["an Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["a JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["a database connection string with a password", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]+@/i],
  ["a password assignment", /^\s*(?:[A-Z_]*(?:PASSWORD|PASSWD|SECRET(?:_KEY)?|API_KEY|TOKEN))\s*[=:]\s*["']?[^\s"']{8,}/im],
];

/** Returns human-readable names of the kinds of secrets detected (deduplicated, at most 3). */
export function findSecrets(text: string): string[] {
  if (!text || text.length > 512 * 1024) return [];
  const found: string[] = [];
  for (const [name, re] of PATTERNS) {
    if (re.test(text)) found.push(name);
    if (found.length === 3) break;
  }
  return found;
}
