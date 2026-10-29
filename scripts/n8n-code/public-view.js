function publicLead(lead) {
  return {
    name: lead.name,
    email: lead.email,
    company: lead.company,
    website: lead.website,
    linkedinUrl: lead.linkedinUrl || null,
    notes: lead.notes || '',
  };
}

function publicWebsite(website) {
  const source = website || {};
  return {
    fetched: Boolean(source.fetched),
    statusCode: source.statusCode || null,
    excerpt: String(source.excerpt || '').slice(0, 280),
    error: source.error || null,
  };
}

function publicModel(state) {
  return {
    mode: state.config.claudeMode,
    name: state.config.claudeModel,
    attempts: state.attempts,
    envAccess: Boolean(state.config.envAccess),
  };
}
