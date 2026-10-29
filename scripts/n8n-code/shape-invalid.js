const state = $input.first().json;
return [
  {
    json: {
      ok: false,
      error: 'validation_failed',
      messages: state.validationErrors || ['The lead could not be validated.'],
    },
  },
];
