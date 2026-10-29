const state = __STATE_EXPR__;
const result = mockQualify({
  lead: state.lead,
  websiteText: state.website.excerpt || '',
  icp: state.config.icp,
  attempt: __ATTEMPT__,
  force: state.force || null,
});

return [
  {
    json: {
      ...state,
      attempts: __ATTEMPT__,
      rawModelText: result.rawText,
      qualification: null,
      jsonValid: false,
    },
  },
];
