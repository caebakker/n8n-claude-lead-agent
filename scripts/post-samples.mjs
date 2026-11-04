import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQualification } from './lib/qualify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const update = process.argv.includes('--update');
const check = process.argv.includes('--check') || update;
const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:5678/webhook/lead-agent';
const icp = JSON.parse(fs.readFileSync(path.join(root, 'prompts/icp.json'), 'utf8'));
const leadsDir = path.join(root, 'samples/leads');
const outputDir = path.join(root, 'samples/outputs');

function outputPath(name) {
  return path.join(outputDir, name);
}

async function post(lead, headers = {}) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(lead),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new Error(`Non-JSON response (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }
  return { status: response.status, body };
}

function stable(value) {
  return JSON.stringify(value);
}

async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company: 'probe' }),
      });
      const text = await response.text();
      if (response.status === 400 && text.includes('validation_failed')) {
        ready = true;
        break;
      }
    } catch (error) {
      ready = false;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!ready) {
    throw new Error(`The lead webhook did not register at ${webhookUrl}. Start n8n, import the workflow, publish it, and restart n8n.`);
  }

  const leadFiles = fs.readdirSync(leadsDir).filter((name) => name.endsWith('.json')).sort();
  const cases = [];
  leadFiles.forEach((file, index) => {
    const lead = JSON.parse(fs.readFileSync(path.join(leadsDir, file), 'utf8'));
    cases.push({
      name: file,
      lead,
      headers: index === 0 ? { 'x-reset-store': 'true' } : {},
      expectStatus: file.includes('malformed') ? 422 : 200,
    });
  });

  const firstLead = cases[0].lead;
  cases.push({
    name: '06-duplicate-northwind.json',
    lead: firstLead,
    headers: {},
    expectStatus: 200,
    duplicate: true,
  });
  cases.push({
    name: '07-invalid-input.json',
    lead: { company: 'Missing fields' },
    headers: {},
    expectStatus: 400,
  });

  fs.mkdirSync(outputDir, { recursive: true });
  let failed = 0;

  for (const item of cases) {
    const result = await post(item.lead, item.headers);
    const file = outputPath(item.name);
    if (update) fs.writeFileSync(file, `${JSON.stringify(result.body, null, 2)}\n`);
    const problems = [];
    if (result.status !== item.expectStatus) {
      problems.push(`HTTP ${result.status}, expected ${item.expectStatus}`);
    }
    if (item.duplicate && result.body.duplicate !== true) problems.push('expected duplicate: true');
    if (!item.duplicate && item.expectStatus === 200 && result.body.duplicate !== false) {
      problems.push('expected duplicate: false');
    }
    if (item.expectStatus === 200 && result.body.ok !== true) problems.push('expected ok: true');
    if (item.expectStatus === 200) {
      const errors = validateQualification(result.body.qualification, icp);
      if (errors.length) problems.push(errors.join('; '));
      if (result.body.model?.mode !== 'mock') problems.push(`expected mock mode, got ${result.body.model?.mode}`);
    }
    if (item.expectStatus === 422 && result.body.error !== 'model_output_invalid') {
      problems.push(`unexpected error ${result.body.error}`);
    }
    if (item.expectStatus === 400 && result.body.error !== 'validation_failed') {
      problems.push(`unexpected error ${result.body.error}`);
    }
    if (check && fs.existsSync(file)) {
      const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (stable(expected) !== stable(result.body)) problems.push(`body does not match ${path.relative(root, file)}`);
    } else if (check && !update) {
      problems.push(`missing expected file ${path.relative(root, file)}`);
    }
    if (problems.length) {
      failed += 1;
      console.error(`FAIL ${item.name}: ${problems.join(' | ')}`);
      console.error(JSON.stringify(result.body, null, 2));
    } else {
      console.log(`OK   ${item.name} (${result.status})`);
    }
  }

  const retryLead = {
    name: 'Ida Frost',
    email: 'ida.frost@retry-once.example',
    company: 'Retry Once Fixtures',
    website: 'https://example.com',
    notes: 'B2B team of 30 people. Manual CRM updates. FORCE_MALFORMED_ONCE',
  };
  const retry = await post(retryLead);
  const retryErrors = validateQualification(retry.body.qualification, icp);
  if (retry.status !== 200 || retry.body.ok !== true || retry.body.model?.attempts !== 2 || retryErrors.length) {
    failed += 1;
    console.error('FAIL retry-once did not recover on the second attempt');
    console.error(JSON.stringify(retry.body, null, 2));
  } else {
    console.log('OK   retry-once (200, attempts 2)');
  }

  if (failed) process.exit(1);
  console.log(update ? 'Sample outputs updated.' : 'Sample posts passed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
