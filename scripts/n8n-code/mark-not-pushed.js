const state = $input.first().json;
const tier = state.qualification.tier;

return [
  {
    json: {
      ...state,
      routing: {
        tier,
        action: tier === 'warm' ? 'review' : 'log_only',
        crm: { provider: 'none', action: 'skipped' },
        notification: 'not_sent',
      },
    },
  },
];
