function htmlToText(html) {
  if (typeof html !== 'string' || html.trim() === '') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

const prior = $('Deduplicate').first().json;
const response = $input.first().json;
const statusCode = Number(response.statusCode || 0);
const html = typeof response.html === 'string' ? response.html : '';
const excerpt = htmlToText(html);
const fetched = statusCode >= 200 && statusCode < 400 && excerpt.length > 0;

return [
  {
    json: {
      ...prior,
      website: {
        fetched,
        statusCode: statusCode || null,
        excerpt,
        error: fetched ? null : `Website returned status ${statusCode || 'unknown'} and no readable text.`,
      },
    },
  },
];
