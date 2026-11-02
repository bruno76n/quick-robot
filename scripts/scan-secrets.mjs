// Secret scan (docs/11 A04): fails if a tracked file looks like it carries a credential.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

export const PATTERNS = [
  ['private key', /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Stripe key', /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['connection string with password', /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^:\s/]+:(?!qr@|test@|postgres@|password@)[^@\s]{6,}@(?!127\.0\.0\.1|localhost)/],
  ['hardcoded secret', /\b(secret|password|api[_-]?key|token)\b\s*[:=]\s*['"][A-Za-z0-9+/=_-]{24,}['"]/i],
];
const SKIP = /(^|\/)(pnpm-lock\.yaml|.*\.(png|ico|icns|woff2?|ttf|jpg|jpeg|webp))$|^reference\/|^spikes\/.*\/pnpm-lock\.yaml$/;

export function scanText(text) {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export function scanRepo(cwd = process.cwd()) {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd, encoding: 'utf8' }).split('\n').filter(Boolean);
  const findings = [];
  for (const f of files) {
    if (SKIP.test(f) || f.startsWith('.env')) {
      if (/^\.env(?!\.example$)/.test(f)) findings.push({ file: f, kinds: ['.env file in the repository'] });
      continue;
    }
    let st; try { st = statSync(`${cwd}/${f}`); } catch { continue; }
    if (st.size > 2_000_000) continue;
    const kinds = scanText(readFileSync(`${cwd}/${f}`, 'utf8'));
    if (kinds.length) findings.push({ file: f, kinds });
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = scanRepo();
  for (const f of findings) console.error(`possible secret: ${f.file} (${f.kinds.join(', ')})`);
  console.log(findings.length ? `secret scan FAILED (${findings.length})` : 'secret scan ok');
  process.exit(findings.length ? 1 : 0);
}
