import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIXTURES,
  mockQualify,
  parseModelText,
  validateQualification,
} from './lib/qualify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icp = JSON.parse(fs.readFileSync(path.join(root, 'prompts/icp.json'), 'utf8'));
const leadsDir = path.join(root, 'samples/leads');
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

for (const [email, qualification] of Object.entries(FIXTURES)) {
  const errors = validateQualification(qualification, icp);
  assert(errors.length === 0, `${email} fixture: ${errors.join('; ')}`);
}

const leadFiles = fs.readdirSync(leadsDir).filter((name) => name.endsWith('.json')).sort();
assert(leadFiles.length >= 3 && leadFiles.length <= 5, `expected 3 to 5 sample leads, found ${leadFiles.length}`);

for (const file of leadFiles) {
  const lead = JSON.parse(fs.readFileSync(path.join(leadsDir, file), 'utf8'));
  const force = /\bFORCE_MALFORMED_ONCE\b/.test(lead.notes || '')
    ? 'once'
    : /\bFORCE_MALFORMED\b/.test(lead.notes || '')
      ? 'malformed'
      : null;
  const first = mockQualify({ lead, websiteText: 'Example Domain', icp, attempt: 1, force });
  if (force === 'malformed') {
    assert(!parseModelText(first.rawText).ok, `${file} should be invalid JSON on attempt 1`);
    const second = mockQualify({ lead, websiteText: 'Example Domain', icp, attempt: 2, force });
    assert(!parseModelText(second.rawText).ok, `${file} should stay invalid on attempt 2`);
    continue;
  }
  const parsed = parseModelText(first.rawText);
  assert(parsed.ok, `${file} mock text should parse`);
  const errors = parsed.ok ? validateQualification(parsed.value, icp) : parsed.errors;
  assert(errors.length === 0, `${file} qualification: ${errors.join('; ')}`);
}

const once = mockQualify({
  lead: { email: 'ida.frost@retry-once.example', company: 'Retry Once Fixtures', notes: 'B2B team of 30 people. Manual CRM updates.' },
  websiteText: 'Example Domain',
  icp,
  attempt: 1,
  force: 'once',
});
const onceRetry = mockQualify({
  lead: { email: 'ida.frost@retry-once.example', company: 'Retry Once Fixtures', notes: 'B2B team of 30 people. Manual CRM updates.' },
  websiteText: 'Example Domain',
  icp,
  attempt: 2,
  force: 'once',
});
assert(!parseModelText(once.rawText).ok, 'retry-once attempt 1 should be invalid');
const retryParsed = parseModelText(onceRetry.rawText);
assert(retryParsed.ok && validateQualification(retryParsed.value, icp).length === 0, 'retry-once attempt 2 should validate');

if (failed) {
  console.error(`${failed} qualification check(s) failed`);
  process.exit(1);
}
console.log(`Qualification checks passed (${leadFiles.length} sample leads).`);
