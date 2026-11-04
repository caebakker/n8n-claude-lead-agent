// Synced from prompts/icp.json and prompts/system-prompt.md by scripts/build-workflow.mjs
function readEnv(name, fallback) {
  try {
    const value = $env[name];
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text === '' ? fallback : text;
  } catch (error) {
    return fallback;
  }
}

let envAccess = true;
try {
  void $env;
} catch (error) {
  envAccess = false;
}

const icp = __ICP_JSON__;
const systemPrompt = __SYSTEM_PROMPT_JSON__;
const item = $input.first().json;
const claudeMode = readEnv('CLAUDE_MODE', 'mock').toLowerCase() === 'live' ? 'live' : 'mock';
const crmMode = readEnv('CRM_MODE', 'stub').toLowerCase() === 'hubspot' ? 'hubspot' : 'stub';
const body = item.body !== undefined ? item.body : item;

return [
  {
    json: {
      config: {
        claudeMode,
        claudeModel: readEnv('CLAUDE_MODEL', 'claude-sonnet-5-5'),
        crmMode,
        envAccess,
        maxAttempts: 2,
        icp,
        systemPrompt,
      },
      request: {
        body,
        headers: item.headers || {},
      },
    },
  },
];
