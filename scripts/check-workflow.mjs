import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const textFiles = walk(root).filter((file) => /\.(md|json|js|mjs|yml|yaml|txt|sh|example)$/.test(file));
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('\u2014') || text.includes('\u2013')) {
    fail(`${path.relative(root, file)} contains an em dash or en dash`);
  }
}

const icp = JSON.parse(fs.readFileSync(path.join(root, 'prompts/icp.json'), 'utf8'));
const systemPrompt = fs.readFileSync(path.join(root, 'prompts/system-prompt.md'), 'utf8').trim();
const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/lead-agent.json'), 'utf8'));
const errorWorkflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/error-handler.json'), 'utf8'));

for (const current of [workflow, errorWorkflow]) {
  for (const key of ['name', 'nodes', 'connections', 'settings']) {
    if (current[key] === undefined) fail(`${current.name || 'workflow'} is missing ${key}`);
  }
}

const names = new Set();
const ids = new Set();
for (const node of workflow.nodes) {
  if (names.has(node.name)) fail(`duplicate node name ${node.name}`);
  names.add(node.name);
  if (ids.has(node.id)) fail(`duplicate node id ${node.id}`);
  ids.add(node.id);
  if (!Array.isArray(node.position) || node.position.length !== 2) fail(`${node.name} has no position`);
  if (node.credentials) {
    const blob = JSON.stringify(node.credentials);
    if (!blob.includes('REPLACE_WITH_')) fail(`${node.name} credential is not a placeholder`);
    if (/sk-ant-|xox[baprs]-|pat-na1-/i.test(blob)) fail(`${node.name} looks like it contains a real secret`);
  }
  if (node.type === 'n8n-nodes-base.code') {
    const jsCode = node.parameters?.jsCode;
    if (typeof jsCode !== 'string' || jsCode.trim() === '') fail(`${node.name} has empty code`);
    else {
      const temp = path.join(os.tmpdir(), `n8n-code-${node.id}.js`);
      fs.writeFileSync(temp, jsCode);
      try {
        execFileSync(process.execPath, ['--check', temp], { stdio: 'pipe' });
      } catch (error) {
        fail(`${node.name} has a JavaScript syntax error`);
      } finally {
        fs.rmSync(temp, { force: true });
      }
    }
  }
}

for (const [from, outputs] of Object.entries(workflow.connections)) {
  if (!names.has(from)) fail(`connection source missing: ${from}`);
  for (const group of outputs.main || []) {
    for (const edge of group) {
      if (!names.has(edge.node)) fail(`${from} connects to missing node ${edge.node}`);
    }
  }
}

const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
const webhook = byName.Webhook;
if (webhook?.parameters?.path !== 'lead-agent') fail('webhook path is not lead-agent');
if (webhook?.parameters?.responseMode !== 'responseNode') fail('webhook does not use a response node');
if (byName['Notify Slack']?.disabled !== true) fail('Slack node should be disabled');
if (byName['Upsert HubSpot contact']?.parameters?.operation !== 'upsert') fail('HubSpot node is not an upsert');
if (byName['Claude attempt 1']?.parameters?.url !== 'https://api.anthropic.com/v1/messages') {
  fail('Claude node does not call the Messages API');
}

const loadConfig = byName['Load config']?.parameters?.jsCode || '';
if (!loadConfig.includes(icp.name)) fail('Load config is out of date with prompts/icp.json');
const promptLine = systemPrompt.split('\n').find((line) => line.trim());
if (!loadConfig.includes(promptLine)) fail('Load config is out of date with prompts/system-prompt.md');

const mock = byName['Mock attempt 1']?.parameters?.jsCode || '';
if (!mock.includes('mara.ellison@northwind.example')) fail('mock fixtures are not embedded');

const errorSlack = errorWorkflow.nodes.find((node) => node.name === 'Notify Slack');
if (!errorSlack?.disabled) fail('error workflow Slack node should be disabled');
if (!errorWorkflow.nodes.some((node) => node.type === 'n8n-nodes-base.errorTrigger')) {
  fail('error workflow has no error trigger');
}

if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  process.exit(1);
}
console.log(`Workflow checks passed (${workflow.nodes.length} nodes in the lead agent).`);
