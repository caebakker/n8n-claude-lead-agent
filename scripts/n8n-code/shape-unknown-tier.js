const state = $input.first().json;
pushError({
  kind: 'tier_unroutable',
  email: state.lead ? state.lead.email : null,
  message: 'The qualification tier was not hot, warm, or cold.',
});

return [
  {
    json: {
      ok: false,
      error: 'tier_unroutable',
      messages: ['The qualification tier was not hot, warm, or cold.'],
      attempts: state.attempts || null,
    },
  },
];
