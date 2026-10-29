const input = $input.first().json;
let state;
let raw;

if (input && input.lead && input.config && typeof input.rawModelText === 'string') {
  state = input;
  raw = input.rawModelText;
} else {
  state = { ...$('__STATE_NODE__').first().json, attempts: __ATTEMPT__ };
  const body = input && input.body && typeof input.body === 'object' ? input.body : input;
  if (body && Array.isArray(body.content)) {
    raw = body.content
      .filter((block) => block && block.type === 'text')
      .map((block) => block.text || '')
      .join('\n');
  } else if (typeof input.data === 'string') {
    raw = input.data;
  } else {
    raw = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  }
}

const parsed = parseModelText(raw);
const errors = parsed.ok ? validateQualification(parsed.value, state.config.icp) : parsed.errors;

return [
  {
    json: {
      ...state,
      rawModelText: raw,
      attempts: state.attempts || __ATTEMPT__,
      validationErrorsModel: errors,
      jsonValid: errors.length === 0,
      qualification: errors.length === 0 ? parsed.value : null,
    },
  },
];
