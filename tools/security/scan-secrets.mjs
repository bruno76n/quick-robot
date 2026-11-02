// Secret scan (docs/11 · A04): looks for credentials in every file tracked by git. Exit 1 if any is found.
// Usage: node tools/security/scan-secrets.mjs [files…]   (no files → every file tracked by git)
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const RULES = [
  ['private key', /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Anthropic / OpenAI key', /\bsk-(ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['Stripe secret key', /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['password in URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]{8,})@/i],
  ['assigned secret', /\b(secret|password|passwd|api[_-]?key|token)\s*[:=]\s*['"][A-Za-z0-9+/_-]{24,}['"]/i],
];
/** Known non-secrets: local test databases. */
const ALLOW = [/postgres:\/\/postgres:postgres@127\.0\.0\.1/, /postgres:postgres@127\.0\.0\.1/];
const SKIP = /(^|\/)(pnpm-lock\.yaml|package-lock\.json)$|\.(png|jpe?g|gif|webp|woff2?|ico|zip)$|^reference\//;

const args = process.argv.slice(2);
const files = args.length ? args : execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const hits = [];
for (const f of files) {
  if (SKIP.test(f)) continue;
  let text;
  try {
    if (statSync(f).size > 2_000_000) continue;
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    if (ALLOW.some((a) => a.test(line))) return;
    for (const [name, re] of RULES) if (re.test(line)) hits.push(`${f}:${i + 1}  ${name}`);
  });
}
for (const f of files) if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) hits.push(`${f}  .env file must not be committed`);
if (hits.length) {
  console.error(`Possible secrets found:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`secret scan: ${files.length} files, nothing found`);
