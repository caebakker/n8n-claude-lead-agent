const errorItem = $input.first().json;
const raw = errorItem.error || errorItem;
const message = (raw && (raw.message || raw.description)) || 'Claude request failed.';
let email = null;
try {
  email = $('Prepare qualification').first().json.lead.email;
} catch (error) {
  email = null;
}

pushError({
  kind: 'claude_request_failed',
  email,
  message: String(message).slice(0, 500),
});

return [
  {
    json: {
      ok: false,
      error: 'claude_request_failed',
      messages: [typeof message === 'string' ? message : JSON.stringify(message)],
    },
  },
];
