const state = $('Carry result').first().json;
const hubspot = $input.first().json;
const id = hubspot.id || hubspot.vid || hubspot.canonicalVid || null;

return [
  {
    json: {
      ...state,
      routing: {
        tier: state.qualification.tier,
        action: 'crm_upsert',
        crm: { provider: 'hubspot', action: 'upserted', id },
        notification: 'disabled',
      },
    },
  },
];
