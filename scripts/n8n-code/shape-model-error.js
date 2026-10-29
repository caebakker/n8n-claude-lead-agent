const state = $input.first().json;
const messages =
  state.validationErrorsModel && state.validationErrorsModel.length
    ? state.validationErrorsModel
    : ['Model output was not valid JSON.'];

pushError({
  kind: 'model_output_invalid',
  email: state.lead ? state.lead.email : null,
  message: messages.join('; ').slice(0, 500),
});

return [
  {
    json: {
      ok: false,
      error: 'model_output_invalid',
      messages,
      attempts: state.attempts || 2,
    },
  },
];
