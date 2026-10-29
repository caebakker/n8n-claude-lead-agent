const state = $input.first().json;
let payload = state.request ? state.request.body : null;
if (typeof payload === 'string') {
  try {
    payload = JSON.parse(payload);
  } catch (error) {
    payload = null;
  }
}

const errors = [];
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  errors.push('Body must be a JSON object with name, email, company, and website.');
  return [{ json: { ...state, valid: false, validationErrors: errors, lead: null, force: null } }];
}

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

const name = clean(payload.name);
const email = clean(payload.email).toLowerCase();
const company = clean(payload.company);
let website = clean(payload.website);
const linkedinRaw = clean(payload.linkedinUrl || payload.linkedin || '');
let notes = typeof payload.notes === 'string' ? payload.notes.replace(/\s+/g, ' ').trim() : '';

if (!name) errors.push('name is required.');
if (!email) errors.push('email is required.');
else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email is not a valid address.');
if (!company) errors.push('company is required.');
function httpUrl(value) {
  let url = value;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) return null;
  return url;
}

if (!website) errors.push('website is required.');
else {
  const parsed = httpUrl(website);
  if (!parsed) errors.push('website is not a valid URL.');
  else website = parsed;
}

let linkedinUrl = null;
if (linkedinRaw) {
  const parsed = httpUrl(linkedinRaw);
  if (!parsed) errors.push('linkedinUrl is not a valid URL.');
  else linkedinUrl = parsed;
}

if (notes.length > 4000) notes = notes.slice(0, 4000);
const originalNotes = notes;
let force = null;
if (/\bFORCE_MALFORMED_ONCE\b/.test(originalNotes)) force = 'once';
else if (/\bFORCE_MALFORMED\b/.test(originalNotes)) force = 'malformed';
notes = notes
  .replace(/\bFORCE_MALFORMED_ONCE\b/g, '')
  .replace(/\bFORCE_MALFORMED\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const nameParts = name.split(' ').filter(Boolean);
const headers = state.request.headers || {};
const resetHeader = headers['x-reset-store'] || headers['X-Reset-Store'] || '';

return [
  {
    json: {
      ...state,
      valid: errors.length === 0,
      validationErrors: errors,
      force,
      resetStore: String(resetHeader).toLowerCase() === 'true',
      lead: {
        name,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' '),
        email,
        company,
        website,
        linkedinUrl,
        notes,
      },
    },
  },
];
