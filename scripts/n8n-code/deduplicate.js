const state = $input.first().json;
const store = $getWorkflowStaticData('global');
if (!store.leads || (state.resetStore && state.config.claudeMode === 'mock')) store.leads = {};
if (!Array.isArray(store.errorLog)) store.errorLog = [];

const existing = store.leads[state.lead.email];
if (existing) {
  return [{ json: { ...state, duplicate: true, stored: existing } }];
}
return [{ json: { ...state, duplicate: false } }];
