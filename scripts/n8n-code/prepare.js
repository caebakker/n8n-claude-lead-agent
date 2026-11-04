const state = $input.first().json;
const leadForModel = {
  name: state.lead.name,
  email: state.lead.email,
  company: state.lead.company,
  website: state.lead.website,
  linkedinUrl: state.lead.linkedinUrl,
  notes: state.lead.notes,
};
const user = [
  'ICP JSON:',
  JSON.stringify(state.config.icp),
  '',
  'Lead JSON:',
  JSON.stringify(leadForModel),
  '',
  'Website text:',
  state.website.excerpt || '(none)',
  state.website.error ? `Website note: ${state.website.error}` : '',
  '',
  'Return the JSON object now.',
]
  .filter((line) => line !== '')
  .join('\n');

const claudeRequest = {
  model: state.config.claudeModel,
  max_tokens: 4000,
  system: state.config.systemPrompt,
  messages: [{ role: 'user', content: user }],
};

return [
  {
    json: {
      ...state,
      prompt: { system: state.config.systemPrompt, user },
      claudeRequest,
      attempts: 0,
    },
  },
];
