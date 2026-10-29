const state = $input.first().json;
const store = $getWorkflowStaticData('global');
if (!store.leads) store.leads = {};

const response = {
  ok: true,
  duplicate: false,
  lead: publicLead(state.lead),
  website: publicWebsite(state.website),
  qualification: state.qualification,
  routing: state.routing,
  model: publicModel(state),
};

store.leads[state.lead.email] = {
  lead: response.lead,
  website: response.website,
  qualification: response.qualification,
  routing: response.routing,
  model: response.model,
  storedAt: new Date().toISOString(),
};

console.log(`Logged ${response.lead.email} as ${response.qualification.tier} (${response.qualification.score})`);

return [{ json: response }];
