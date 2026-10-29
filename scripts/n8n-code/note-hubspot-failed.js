const state = $('Carry result').first().json;
const errorItem = $input.first().json;
const raw = errorItem.error || errorItem;
const message = (raw && (raw.message || raw.description)) || 'HubSpot request failed.';

pushError({
  kind: 'hubspot',
  email: state.lead.email,
  message: String(message).slice(0, 500),
});

return [
  {
    json: {
      ...state,
      routing: {
        tier: state.qualification.tier,
        action: 'crm_upsert',
        crm: {
          provider: 'hubspot',
          action: 'failed',
          id: null,
          error: typeof message === 'string' ? message : JSON.stringify(message),
        },
        notification: 'disabled',
      },
    },
  },
];
