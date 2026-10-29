const stored = $input.first().json.stored;
return [
  {
    json: {
      ok: true,
      duplicate: true,
      lead: stored.lead,
      website: stored.website,
      qualification: stored.qualification,
      routing: stored.routing,
      model: stored.model,
    },
  },
];
