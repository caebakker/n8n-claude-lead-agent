const state = $input.first().json;
const id = `stub_${state.lead.email.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

return [
  {
    json: {
      ...state,
      routing: {
        tier: state.qualification.tier,
        action: 'crm_upsert',
        crm: { provider: 'stub', action: 'upserted', id },
        notification: 'disabled',
      },
    },
  },
];
