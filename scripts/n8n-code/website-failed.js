const prior = $('Deduplicate').first().json;
const errorItem = $input.first().json;
const raw = errorItem.error || errorItem;
const message =
  (raw && (raw.message || raw.description)) ||
  errorItem.message ||
  'Website request failed.';

return [
  {
    json: {
      ...prior,
      website: {
        fetched: false,
        statusCode: null,
        excerpt: '',
        error: typeof message === 'string' ? message : JSON.stringify(message),
      },
    },
  },
];
