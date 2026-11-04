import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const icp = JSON.parse(read('prompts/icp.json'));
const systemPrompt = read('prompts/system-prompt.md').trim();
const qualifyLib = read('scripts/lib/qualify.mjs').replace(/^export /gm, '');
const publicView = read('scripts/n8n-code/public-view.js');
const errorLog = read('scripts/n8n-code/error-log.js');

function source(rel, replacements = {}) {
  let text = read(rel).trim();
  for (const [key, value] of Object.entries(replacements)) {
    text = text.replaceAll(key, value);
  }
  return text;
}

function code(parts) {
  return {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: parts.filter(Boolean).join('\n\n'),
  };
}

let seq = 1;
function uid() {
  const n = String(seq++).padStart(4, '0');
  return `c0ffee00-0000-4000-8000-00000000${n}`;
}

function makeNode(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    id: uid(),
    name,
    type,
    typeVersion,
    position,
    parameters,
    ...extra,
  };
}

function ifTrue(left, id) {
  return {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 2,
      },
      conditions: [
        {
          id,
          leftValue: left,
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    options: {},
  };
}

function ifEquals(left, right, id) {
  return {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 2,
      },
      conditions: [
        {
          id,
          leftValue: left,
          rightValue: right,
          operator: { type: 'string', operation: 'equals' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  };
}

function tierRule(tier, id) {
  return {
    conditions: ifEquals('={{ $json.qualification.tier }}', tier, id).conditions,
    renameOutput: true,
    outputKey: tier,
  };
}

const claudeHttp = {
  method: 'POST',
  url: 'https://api.anthropic.com/v1/messages',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendHeaders: true,
  headerParameters: {
    parameters: [{ name: 'anthropic-version', value: '2023-06-01' }],
  },
  sendBody: true,
  contentType: 'json',
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json.claudeRequest) }}',
  options: {
    timeout: 60000,
    response: {
      response: {
        fullResponse: true,
        responseFormat: 'json',
      },
    },
  },
};

const claudeCredentials = {
  httpHeaderAuth: {
    id: 'REPLACE_WITH_ANTHROPIC_HEADER_AUTH_ID',
    name: 'Anthropic x-api-key (placeholder)',
  },
};

const claudeNotes =
  'Placeholder credential only. Create a Header Auth credential with name x-api-key and your Anthropic key, then select it here. This node does not run when CLAUDE_MODE is mock.';

function respond(codeStatus) {
  return {
    respondWith: 'json',
    responseBody: '={{ $json }}',
    options: { responseCode: codeStatus },
  };
}

const nodes = [
  makeNode('Sticky: start', 'n8n-nodes-base.stickyNote', 1, [-80, -40], {
    content:
      '## Start here\n\nPOST one lead as JSON to `/webhook/lead-agent`.\n\nThis sample has no webhook authentication. Add Header Auth before you expose it.\n\n`CLAUDE_MODE=mock` and `CRM_MODE=stub` are the defaults, so the demo runs with no API keys. Set `live` and `hubspot` when you are ready to call those APIs.',
    height: 280,
    width: 420,
    color: 4,
  }),
  makeNode(
    'Webhook',
    'n8n-nodes-base.webhook',
    2.1,
    [400, 280],
    {
      httpMethod: 'POST',
      path: 'lead-agent',
      responseMode: 'responseNode',
      options: {},
    },
    {
      webhookId: 'c0ffee00-0000-4000-8000-0000000000aa',
      notes: 'Production URL ends in /webhook/lead-agent. The test URL is only active while you listen in the editor.',
    },
  ),
  makeNode(
    'Load config',
    'n8n-nodes-base.code',
    2,
    [680, 280],
    code([
      source('scripts/n8n-code/load-config.js', {
        __ICP_JSON__: JSON.stringify(icp),
        __SYSTEM_PROMPT_JSON__: JSON.stringify(systemPrompt),
      }),
    ]),
  ),
  makeNode('Normalise lead', 'n8n-nodes-base.code', 2, [960, 280], code([source('scripts/n8n-code/normalise.js')])),
  makeNode('Input valid?', 'n8n-nodes-base.if', 2.2, [1240, 280], ifTrue('={{ $json.valid }}', 'input-valid')),
  makeNode('Shape invalid input', 'n8n-nodes-base.code', 2, [1240, 560], code([source('scripts/n8n-code/shape-invalid.js')])),
  makeNode('Respond 400', 'n8n-nodes-base.respondToWebhook', 1.4, [1520, 560], respond(400)),
  makeNode(
    'Deduplicate',
    'n8n-nodes-base.code',
    2,
    [1520, 280],
    code([source('scripts/n8n-code/deduplicate.js')]),
    {
      notes:
        'Stores completed leads in workflow static data, keyed by email. Swap this node for an n8n Data table or a Google Sheet when you leave the demo.',
      notesInFlow: true,
    },
  ),
  makeNode('Already seen?', 'n8n-nodes-base.if', 2.2, [1800, 280], ifTrue('={{ $json.duplicate }}', 'already-seen')),
  makeNode('Shape duplicate', 'n8n-nodes-base.code', 2, [1800, 560], code([source('scripts/n8n-code/shape-duplicate.js')])),
  makeNode(
    'Fetch website',
    'n8n-nodes-base.httpRequest',
    4.2,
    [2080, 160],
    {
      method: 'GET',
      url: '={{ $json.lead.website }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'User-Agent', value: 'lead-agent-sample/1.0' }],
      },
      options: {
        timeout: 15000,
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'text',
            outputPropertyName: 'html',
          },
        },
      },
    },
    { onError: 'continueErrorOutput' },
  ),
  makeNode('Extract website text', 'n8n-nodes-base.code', 2, [2360, 80], code([source('scripts/n8n-code/extract-text.js')])),
  makeNode('Website fetch failed', 'n8n-nodes-base.code', 2, [2360, 320], code([source('scripts/n8n-code/website-failed.js')])),
  makeNode('Prepare qualification', 'n8n-nodes-base.code', 2, [2640, 200], code([source('scripts/n8n-code/prepare.js')])),
  makeNode(
    'Use live Claude?',
    'n8n-nodes-base.if',
    2.2,
    [2920, 200],
    ifEquals('={{ $json.config.claudeMode }}', 'live', 'claude-mode'),
  ),
  makeNode('Claude attempt 1', 'n8n-nodes-base.httpRequest', 4.2, [3200, 40], claudeHttp, {
    onError: 'continueErrorOutput',
    credentials: claudeCredentials,
    notes: claudeNotes,
    notesInFlow: true,
  }),
  makeNode(
    'Mock attempt 1',
    'n8n-nodes-base.code',
    2,
    [3200, 360],
    code([
      qualifyLib,
      source('scripts/n8n-code/mock.js', {
        __STATE_EXPR__: "$('Prepare qualification').first().json",
        __ATTEMPT__: '1',
      }),
    ]),
    {
      notes:
        'Demo mode. Sample emails return pinned qualifications so the walkthrough matches samples/outputs. Any other email uses the heuristic in scripts/lib/qualify.mjs. Live mode does not use this node.',
      notesInFlow: true,
    },
  ),
  makeNode(
    'Validate attempt 1',
    'n8n-nodes-base.code',
    2,
    [3520, 200],
    code([
      qualifyLib,
      source('scripts/n8n-code/validate.js', {
        __STATE_NODE__: 'Prepare qualification',
        __ATTEMPT__: '1',
      }),
    ]),
  ),
  makeNode('JSON valid?', 'n8n-nodes-base.if', 2.2, [3800, 200], ifTrue('={{ $json.jsonValid }}', 'json-valid-1')),
  makeNode(
    'Use live Claude on retry?',
    'n8n-nodes-base.if',
    2.2,
    [4080, 480],
    ifEquals('={{ $json.config.claudeMode }}', 'live', 'claude-mode-retry'),
  ),
  makeNode('Build retry request', 'n8n-nodes-base.code', 2, [4360, 360], code([source('scripts/n8n-code/build-retry.js')])),
  makeNode('Claude attempt 2', 'n8n-nodes-base.httpRequest', 4.2, [4640, 240], claudeHttp, {
    onError: 'continueErrorOutput',
    credentials: claudeCredentials,
    notes: claudeNotes,
  }),
  makeNode(
    'Mock attempt 2',
    'n8n-nodes-base.code',
    2,
    [4640, 600],
    code([
      qualifyLib,
      source('scripts/n8n-code/mock.js', {
        __STATE_EXPR__: "$('Validate attempt 1').first().json",
        __ATTEMPT__: '2',
      }),
    ]),
  ),
  makeNode(
    'Validate attempt 2',
    'n8n-nodes-base.code',
    2,
    [4960, 480],
    code([
      qualifyLib,
      source('scripts/n8n-code/validate.js', {
        __STATE_NODE__: 'Build retry request',
        __ATTEMPT__: '2',
      }),
    ]),
  ),
  makeNode(
    'JSON valid after retry?',
    'n8n-nodes-base.if',
    2.2,
    [5240, 480],
    ifTrue('={{ $json.jsonValid }}', 'json-valid-2'),
  ),
  makeNode(
    'Shape model error',
    'n8n-nodes-base.code',
    2,
    [5520, 680],
    code([errorLog, source('scripts/n8n-code/shape-model-error.js')]),
  ),
  makeNode(
    'Shape unknown tier',
    'n8n-nodes-base.code',
    2,
    [5520, 880],
    code([errorLog, source('scripts/n8n-code/shape-unknown-tier.js')]),
  ),
  makeNode('Respond 422', 'n8n-nodes-base.respondToWebhook', 1.4, [5800, 760], respond(422)),
  makeNode(
    'Shape upstream error',
    'n8n-nodes-base.code',
    2,
    [3520, 720],
    code([errorLog, source('scripts/n8n-code/shape-upstream.js')]),
  ),
  makeNode('Respond 502', 'n8n-nodes-base.respondToWebhook', 1.4, [3800, 720], respond(502)),
  makeNode('Carry result', 'n8n-nodes-base.code', 2, [4360, 80], code([source('scripts/n8n-code/carry.js')])),
  makeNode('Route by tier', 'n8n-nodes-base.switch', 3.2, [4640, 80], {
    mode: 'rules',
    rules: {
      values: [tierRule('hot', 'tier-hot'), tierRule('warm', 'tier-warm'), tierRule('cold', 'tier-cold')],
    },
    options: {
      fallbackOutput: 'extra',
      renameFallbackOutput: 'Other',
    },
  }),
  makeNode(
    'Use HubSpot?',
    'n8n-nodes-base.if',
    2.2,
    [4920, -40],
    ifEquals('={{ $json.config.crmMode }}', 'hubspot', 'crm-mode'),
  ),
  makeNode(
    'Upsert HubSpot contact',
    'n8n-nodes-base.hubspot',
    2.2,
    [5200, -180],
    {
      authentication: 'appToken',
      resource: 'contact',
      operation: 'upsert',
      email: '={{ $json.lead.email }}',
      additionalFields: {
        firstName: '={{ $json.lead.firstName }}',
        lastName: '={{ $json.lead.lastName }}',
        companyName: '={{ $json.lead.company }}',
        websiteUrl: '={{ $json.lead.website }}',
      },
    },
    {
      onError: 'continueErrorOutput',
      credentials: {
        hubspotAppToken: {
          id: 'REPLACE_WITH_HUBSPOT_APP_TOKEN_ID',
          name: 'HubSpot app token (placeholder)',
        },
      },
      notes:
        'Placeholder app token. Reached only when CRM_MODE=hubspot. No HubSpot account: keep the CRM stub, or replace this node with Google Sheets Append (email, name, company, score, tier, summary, suggestedFirstLine).',
      notesInFlow: true,
    },
  ),
  makeNode(
    'Note HubSpot result',
    'n8n-nodes-base.code',
    2,
    [5480, -260],
    code([source('scripts/n8n-code/note-hubspot.js')]),
  ),
  makeNode(
    'Note HubSpot failure',
    'n8n-nodes-base.code',
    2,
    [5480, -80],
    code([errorLog, source('scripts/n8n-code/note-hubspot-failed.js')]),
  ),
  makeNode(
    'CRM stub',
    'n8n-nodes-base.code',
    2,
    [5200, 80],
    code([source('scripts/n8n-code/crm-stub.js')]),
    {
      notes:
        'Default CRM. Writes a stable stub id into the webhook response and the local store. A sheet row with the same fields is the documented swap.',
    },
  ),
  makeNode(
    'Notify Slack',
    'n8n-nodes-base.slack',
    2.7,
    [5760, -180],
    {
      authentication: 'accessToken',
      resource: 'message',
      operation: 'post',
      select: 'channel',
      channelId: {
        __rl: true,
        mode: 'name',
        value: '#leads',
      },
      messageType: 'text',
      text: "={{ 'Hot lead: ' + $json.lead.company + ' (' + $json.lead.email + '), score ' + $json.qualification.score + ', tier ' + $json.qualification.tier + '.' }}",
    },
    {
      disabled: true,
      credentials: {
        slackApi: {
          id: 'REPLACE_WITH_SLACK_CREDENTIAL_ID',
          name: 'Slack bot token (placeholder)',
        },
      },
      notes:
        'Disabled by default. Enable after you attach a Slack access token and confirm the channel. Swap this node for Gmail or Send Email if you would rather be emailed.',
      notesInFlow: true,
    },
  ),
  makeNode('Mark not pushed', 'n8n-nodes-base.code', 2, [4920, 280], code([source('scripts/n8n-code/mark-not-pushed.js')])),
  makeNode(
    'Log lead',
    'n8n-nodes-base.code',
    2,
    [6040, 160],
    code([publicView, source('scripts/n8n-code/log-lead.js')]),
  ),
  makeNode('Respond 200', 'n8n-nodes-base.respondToWebhook', 1.4, [6320, 160], respond(200)),
  makeNode('Sticky: store', 'n8n-nodes-base.stickyNote', 1, [1480, -40], {
    content:
      '## Deduplicate\n\nWorkflow static data, one row per email, on this n8n instance only.\n\nSwap for a Data table named `leads` (Row, If row exists, match email) or a Google Sheet lookup.\n\nHeader `x-reset-store: true` clears the store only while Claude mode is mock.',
    height: 250,
    width: 380,
    color: 5,
  }),
  makeNode('Sticky: claude', 'n8n-nodes-base.stickyNote', 1, [2600, -40], {
    content:
      '## Claude\n\nLive mode calls the Messages API. The model id comes from `CLAUDE_MODEL` (default `claude-sonnet-5-5`).\n\nThe system prompt and ICP are copied from `prompts/` when you run `node scripts/build-workflow.mjs`.\n\nJSON is validated against the ICP thresholds. One retry, then a 422 response. Website failures still continue, with empty text.',
    height: 280,
    width: 420,
    color: 6,
  }),
  makeNode('Sticky: route', 'n8n-nodes-base.stickyNote', 1, [4560, -360], {
    content:
      '## Route by tier\n\nHot leads go to HubSpot or the CRM stub, then the disabled Slack node.\n\nWarm leads are logged for review and are not pushed to the CRM.\n\nCold leads are logged only.\n\nTo notify on hot leads, enable Slack or replace it with an email node.',
    height: 250,
    width: 400,
    color: 3,
  }),
  makeNode('Sticky: errors', 'n8n-nodes-base.stickyNote', 1, [3480, 560], {
    content:
      '## Errors\n\nClaude HTTP failures answer the webhook with 502. Invalid JSON answers 422. Bad input answers 400.\n\nThe last 50 error notes sit in this workflow\'s static data under `errorLog`.\n\nAlso import `workflows/error-handler.json` and select it as the error workflow in the workflow settings. That catches a crash this branch does not handle.',
    height: 260,
    width: 420,
    color: 2,
  }),
];

const connections = {};
function link(from, outputIndex, to) {
  if (!connections[from]) connections[from] = { main: [] };
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: 'main', index: 0 });
}

link('Webhook', 0, 'Load config');
link('Load config', 0, 'Normalise lead');
link('Normalise lead', 0, 'Input valid?');
link('Input valid?', 0, 'Deduplicate');
link('Input valid?', 1, 'Shape invalid input');
link('Shape invalid input', 0, 'Respond 400');
link('Deduplicate', 0, 'Already seen?');
link('Already seen?', 0, 'Shape duplicate');
link('Already seen?', 1, 'Fetch website');
link('Shape duplicate', 0, 'Respond 200');
link('Fetch website', 0, 'Extract website text');
link('Fetch website', 1, 'Website fetch failed');
link('Extract website text', 0, 'Prepare qualification');
link('Website fetch failed', 0, 'Prepare qualification');
link('Prepare qualification', 0, 'Use live Claude?');
link('Use live Claude?', 0, 'Claude attempt 1');
link('Use live Claude?', 1, 'Mock attempt 1');
link('Claude attempt 1', 0, 'Validate attempt 1');
link('Claude attempt 1', 1, 'Shape upstream error');
link('Mock attempt 1', 0, 'Validate attempt 1');
link('Validate attempt 1', 0, 'JSON valid?');
link('JSON valid?', 0, 'Carry result');
link('JSON valid?', 1, 'Use live Claude on retry?');
link('Use live Claude on retry?', 0, 'Build retry request');
link('Use live Claude on retry?', 1, 'Mock attempt 2');
link('Build retry request', 0, 'Claude attempt 2');
link('Claude attempt 2', 0, 'Validate attempt 2');
link('Claude attempt 2', 1, 'Shape upstream error');
link('Mock attempt 2', 0, 'Validate attempt 2');
link('Validate attempt 2', 0, 'JSON valid after retry?');
link('JSON valid after retry?', 0, 'Carry result');
link('JSON valid after retry?', 1, 'Shape model error');
link('Shape model error', 0, 'Respond 422');
link('Shape unknown tier', 0, 'Respond 422');
link('Shape upstream error', 0, 'Respond 502');
link('Carry result', 0, 'Route by tier');
link('Route by tier', 0, 'Use HubSpot?');
link('Route by tier', 1, 'Mark not pushed');
link('Route by tier', 2, 'Mark not pushed');
link('Route by tier', 3, 'Shape unknown tier');
link('Use HubSpot?', 0, 'Upsert HubSpot contact');
link('Use HubSpot?', 1, 'CRM stub');
link('Upsert HubSpot contact', 0, 'Note HubSpot result');
link('Upsert HubSpot contact', 1, 'Note HubSpot failure');
link('Note HubSpot result', 0, 'Log lead');
link('Note HubSpot result', 0, 'Notify Slack');
link('Note HubSpot failure', 0, 'Log lead');
link('CRM stub', 0, 'Log lead');
link('CRM stub', 0, 'Notify Slack');
link('Mark not pushed', 0, 'Log lead');
link('Log lead', 0, 'Respond 200');

const leadAgent = {
  name: 'Lead enrichment and qualification',
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'Europe/London',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    saveManualExecutions: true,
    executionTimeout: 120,
  },
  pinData: {},
  meta: {
    templateCredsSetupCompleted: false,
  },
  nodes,
  connections,
};

const errorHandler = {
  name: 'Lead agent error handler',
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'Europe/London',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
  },
  pinData: {},
  nodes: [
    makeNode('Error trigger', 'n8n-nodes-base.errorTrigger', 1, [240, 280], {}),
    makeNode(
      'Format error',
      'n8n-nodes-base.code',
      2,
      [520, 280],
      code([errorLog, source('scripts/n8n-code/error-handler-format.js')]),
      {
        notes: 'Keeps the last 50 crash notes in this workflow\'s own static data. The executions list is the full log.',
      },
    ),
    makeNode(
      'Notify Slack',
      'n8n-nodes-base.slack',
      2.7,
      [800, 280],
      {
        authentication: 'accessToken',
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: { __rl: true, mode: 'name', value: '#leads' },
        messageType: 'text',
        text: "={{ 'Lead agent error in ' + ($json.lastNode || 'unknown node') + ': ' + $json.message }}",
      },
      {
        disabled: true,
        credentials: {
          slackApi: {
            id: 'REPLACE_WITH_SLACK_CREDENTIAL_ID',
            name: 'Slack bot token (placeholder)',
          },
        },
        notes: 'Disabled by default. This is a separate workflow, so it needs its own Slack credential selection.',
      },
    ),
    makeNode('Sticky: error workflow', 'n8n-nodes-base.stickyNote', 1, [200, 40], {
      content:
        '## Error workflow\n\nImport this beside the lead agent, then open the lead agent settings and choose this workflow as the error workflow.\n\nn8n only runs it when an execution crashes. The lead agent already answers the webhook from its own error branch for bad input, bad JSON, and Claude HTTP failures.',
      height: 200,
      width: 460,
      color: 2,
    }),
  ],
  connections: {
    'Error trigger': { main: [[{ node: 'Format error', type: 'main', index: 0 }]] },
    'Format error': { main: [[{ node: 'Notify Slack', type: 'main', index: 0 }]] },
  },
};

fs.mkdirSync(path.join(root, 'workflows'), { recursive: true });
fs.writeFileSync(path.join(root, 'workflows/lead-agent.json'), `${JSON.stringify(leadAgent, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'workflows/error-handler.json'), `${JSON.stringify(errorHandler, null, 2)}\n`);
console.log(`Wrote workflows/lead-agent.json (${nodes.length} nodes) and workflows/error-handler.json`);
