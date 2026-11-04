export const COMPANY_SIZES = ['1-9', '10-49', '50-249', '250-999', '1000+', 'unknown'];

export const FIXTURES = {
  'mara.ellison@northwind.example': {
    summary:
      'Northwind Provisions supplies independent cafes and shops on a wholesale basis. Orders still arrive by email and are retyped into the CRM, which is the kind of handoff this offer is built for.',
    industry: 'Wholesale food supply',
    companySize: '10-49',
    score: 86,
    tier: 'hot',
    reasons: [
      'The notes name a founder and a team of about 40 people, inside the ICP size range.',
      'Retyping emailed orders into a CRM is a concrete repetitive handoff.',
      'The company sells to other businesses rather than to consumers.',
    ],
    suggestedFirstLine:
      'The emailed orders you still retype into the CRM are a small, well bounded automation, and I would like to show you how I would connect that inbox to HubSpot.',
  },
  'jonas.pell@lumenfield.example': {
    summary:
      'Lumen Field Services sends technicians to facilities clients and keeps job sheets in spreadsheets plus a separate scheduling tool. Invoicing is still manual, though some automations already exist.',
    industry: 'Field services',
    companySize: '10-49',
    score: 64,
    tier: 'warm',
    reasons: [
      'An operations manager is named, with 18 technicians, which sits in the ICP size range.',
      'Job sheets and invoicing still cross a spreadsheet and a scheduling tool.',
      'Some automations already exist, so the remaining gap needs a look before a strong fit is claimed.',
    ],
    suggestedFirstLine:
      'You already have a few automations in place, and the manual step from job sheet to invoice looks like the next one worth mapping.',
  },
  'priya.shah@paperkite.example': {
    summary:
      'Paper Kite Studio is a two-person illustration practice selling prints to consumers. The request is for a contact form, with no CRM and no operational handoff described.',
    industry: 'Consumer retail',
    companySize: '1-9',
    score: 28,
    tier: 'cold',
    reasons: [
      'The studio sells prints to consumers, which the ICP treats as a poor fit.',
      'A team of two is below the 10 to 250 people range.',
      'The request is a contact form, not a repetitive handoff between systems.',
    ],
    suggestedFirstLine:
      'I mostly help B2B teams join up tools they already use, so I am probably not the right fit for a consumer print shop, but I am happy to point you at a simpler form setup.',
  },
  'helen.okonkwo@harbourlane.example': {
    summary:
      'Harbour Lane Analytics sells analytics to other businesses and has about 80 people. The operations lead wants HubSpot and billing to share account status, replacing a weekly export that is pasted into a sheet.',
    industry: 'B2B analytics',
    companySize: '50-249',
    score: 81,
    tier: 'hot',
    reasons: [
      'A head of ops is the buyer, at a B2B company of about 80 people.',
      'HubSpot and the billing tool are out of sync, and someone pastes a weekly export into a sheet.',
      'The notes mention webhooks, so there is a clear technical path for a first engagement.',
    ],
    suggestedFirstLine:
      'The weekly paste from billing into a sheet, while HubSpot holds the account status, is a webhook job I would scope as a short first engagement.',
  },
};

export function expectedTier(score, icp) {
  if (score >= icp.tiers.hot.minScore) return 'hot';
  if (score >= icp.tiers.warm.minScore) return 'warm';
  return 'cold';
}

export function parseModelText(rawText) {
  if (typeof rawText !== 'string' || rawText.trim() === '') {
    return { ok: false, errors: ['model output was empty'], value: null };
  }
  let text = rawText.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return { ok: false, errors: ['no JSON object in the model output'], value: null };
  }
  try {
    return { ok: true, errors: [], value: JSON.parse(text.slice(start, end + 1)) };
  } catch (error) {
    return { ok: false, errors: [`JSON.parse failed: ${error.message}`], value: null };
  }
}

export function validateQualification(qualification, icp) {
  const errors = [];
  if (!qualification || typeof qualification !== 'object' || Array.isArray(qualification)) {
    return ['qualification must be a JSON object'];
  }
  const allowed = [
    'summary',
    'industry',
    'companySize',
    'score',
    'tier',
    'reasons',
    'suggestedFirstLine',
  ];
  for (const key of Object.keys(qualification)) {
    if (!allowed.includes(key)) errors.push(`unexpected key: ${key}`);
  }
  for (const key of ['summary', 'industry', 'suggestedFirstLine']) {
    if (typeof qualification[key] !== 'string' || qualification[key].trim() === '') {
      errors.push(`${key} must be a non-empty string`);
    }
  }
  if (typeof qualification.summary === 'string' && qualification.summary.length > 800) {
    errors.push('summary is longer than 800 characters');
  }
  if (
    typeof qualification.suggestedFirstLine === 'string' &&
    qualification.suggestedFirstLine.length > 500
  ) {
    errors.push('suggestedFirstLine is longer than 500 characters');
  }
  if (!COMPANY_SIZES.includes(qualification.companySize)) {
    errors.push('companySize is not an allowed value');
  }
  if (!Number.isInteger(qualification.score) || qualification.score < 0 || qualification.score > 100) {
    errors.push('score must be an integer from 0 to 100');
  }
  if (!['hot', 'warm', 'cold'].includes(qualification.tier)) {
    errors.push('tier must be hot, warm, or cold');
  } else if (Number.isInteger(qualification.score) && qualification.tier !== expectedTier(qualification.score, icp)) {
    errors.push('tier does not match the score and the ICP thresholds');
  }
  if (
    !Array.isArray(qualification.reasons) ||
    qualification.reasons.length < 2 ||
    qualification.reasons.length > 4 ||
    qualification.reasons.some((reason) => typeof reason !== 'string' || reason.trim() === '')
  ) {
    errors.push('reasons must be 2 to 4 non-empty strings');
  }
  return errors;
}

function companySizeFromNotes(notes) {
  const sizeMatch = String(notes).match(/\b(\d+)\s*(people|staff|employees|technicians)\b/i);
  if (!sizeMatch) return { companySize: 'unknown', count: null };
  const count = Number(sizeMatch[1]);
  let companySize = '1000+';
  if (count < 10) companySize = '1-9';
  else if (count < 50) companySize = '10-49';
  else if (count < 250) companySize = '50-249';
  else if (count < 1000) companySize = '250-999';
  return { companySize, count };
}

export function scoreUnknownLead(lead, websiteText, icp) {
  const notes = `${lead.notes || ''} ${lead.company || ''}`;
  let score = 38;
  const reasons = [];

  if (/\b(b2b|wholesale|clients|customers|teams)\b/i.test(notes)) {
    score += 14;
    reasons.push('The notes describe a business that sells to other organisations.');
  } else {
    score -= 6;
    reasons.push('The notes do not clearly show a B2B buyer.');
  }

  if (/\b(manual|spreadsheet|retype|re-type|webhook|crm|hubspot|by hand|paste)\b/i.test(notes)) {
    score += 18;
    reasons.push('The notes name a repetitive handoff between tools.');
  } else {
    score -= 8;
    reasons.push('No concrete operational handoff is described.');
  }

  if (/\b(consumer|d2c|etsy|prints|shoppers)\b/i.test(notes)) {
    score -= 24;
    reasons.push('The description reads as a consumer business, which the ICP disqualifies.');
  }

  const { companySize, count } = companySizeFromNotes(notes);
  if (count !== null && count >= 10 && count <= 250) {
    score += 10;
    reasons.push('The stated team size sits inside the ICP range of about 10 to 250 people.');
  } else if (count !== null && count > 250) {
    score -= 18;
    reasons.push('The stated team size is above the ICP range.');
  } else if (count !== null) {
    score -= 12;
    reasons.push('The stated team size is below the ICP range.');
  }

  if (!websiteText) {
    score -= 4;
    reasons.push('The company website could not be read, so this score uses the lead notes only.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = expectedTier(score, icp);
  const trimmed = reasons.slice(0, 4);
  while (trimmed.length < 2) trimmed.push('Fit is based on the text provided with the lead.');

  const summary = websiteText
    ? `${lead.company} was reviewed from the submitted notes and a short extract of the company website. This mock score is a stand-in for Claude when no API key is configured.`
    : `${lead.company} was reviewed from the submitted notes only, because the website text was empty. This mock score is a stand-in for Claude when no API key is configured.`;

  return {
    summary,
    industry: 'unknown',
    companySize,
    score,
    tier,
    reasons: trimmed,
    suggestedFirstLine: `I read the note on ${lead.company} and would like to confirm whether the handoff you described is still the one to fix first.`,
  };
}

export function mockQualify({ lead, websiteText, icp, attempt, force }) {
  if (force === 'malformed' || (force === 'once' && attempt === 1)) {
    return { rawText: 'I could not decide. Please try again later.' };
  }
  const email = String(lead?.email || '').toLowerCase();
  const qualification = FIXTURES[email] || scoreUnknownLead(lead, websiteText, icp);
  return { rawText: JSON.stringify(qualification) };
}
