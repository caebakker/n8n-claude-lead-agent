const previous = $('Validate attempt 1').first().json;
const user = [
  previous.prompt.user,
  '',
  'Your previous output failed validation:',
  (previous.validationErrorsModel || []).join('\n') || 'unknown validation error',
  '',
  'Previous output:',
  String(previous.rawModelText || '').slice(0, 2000),
  '',
  'Return only the JSON object.',
].join('\n');

return [
  {
    json: {
      ...previous,
      prompt: { ...previous.prompt, user },
      claudeRequest: {
        ...previous.claudeRequest,
        messages: [{ role: 'user', content: user }],
      },
    },
  },
];
