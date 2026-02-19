const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

const CUSTOM_FIELDS = [
  { name: 'Loan Types',      fieldKey: 'loan_types',      dataType: 'TEXT' },
  { name: 'Monthly Volume',  fieldKey: 'monthly_volume',  dataType: 'TEXT' },
  { name: 'Current Source',   fieldKey: 'current_source',  dataType: 'TEXT' },
  { name: 'Funnel Answers',  fieldKey: 'funnel_answers',  dataType: 'TEXT' },
  { name: 'Funnel Step Reached', fieldKey: 'funnel_step_reached', dataType: 'TEXT' },
];

async function setupCustomFields() {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');

  const existing = await getCustomFields();
  const existingKeys = existing.map((f) => f.fieldKey);

  const results = [];

  for (const field of CUSTOM_FIELDS) {
    if (existingKeys.includes(`contact.${field.fieldKey}`)) {
      results.push({ field: field.name, status: 'already_exists' });
      continue;
    }

    try {
      const res = await fetch(`${GHL_API_BASE}/locations/${locationId}/customFields`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: field.name,
          dataType: field.dataType,
          fieldKey: field.fieldKey,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        results.push({ field: field.name, status: 'created', id: data.customField?.id });
        console.log(`[GHL] Created custom field: ${field.name}`);
      } else {
        results.push({ field: field.name, status: 'error', error: data });
        console.error(`[GHL] Failed to create field ${field.name}:`, data);
      }
    } catch (err) {
      results.push({ field: field.name, status: 'error', error: err.message });
    }
  }

  return results;
}

async function getCustomFields() {
  const locationId = process.env.GHL_LOCATION_ID;
  const res = await fetch(`${GHL_API_BASE}/locations/${locationId}/customFields`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    console.error('[GHL] Failed to fetch custom fields');
    return [];
  }

  const data = await res.json();
  return data.customFields || [];
}

async function createOrUpdateContact(contactData) {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    console.warn('[GHL] Skipped contact — missing LOCATION_ID');
    return null;
  }

  const body = {
    locationId,
    ...contactData,
  };

  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[GHL] Contact upserted: ${data.contact?.id}`);
      return data;
    }

    console.error('[GHL] Contact upsert error:', data);
    return { error: data };
  } catch (err) {
    console.error('[GHL] Network error:', err.message);
    return { error: err.message };
  }
}

async function addContactNote(contactId, noteBody) {
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ body: noteBody }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[GHL] Note added to contact ${contactId}`);
      return data;
    }

    console.error('[GHL] Note error:', data);
    return { error: data };
  } catch (err) {
    console.error('[GHL] Note network error:', err.message);
    return { error: err.message };
  }
}

async function addContactTags(contactId, tags) {
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ tags }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[GHL] Tags added to contact ${contactId}: ${tags.join(', ')}`);
      return data;
    }

    console.error('[GHL] Tags error:', data);
    return { error: data };
  } catch (err) {
    console.error('[GHL] Tags network error:', err.message);
    return { error: err.message };
  }
}

function formatNoteFromAnswers(answers, step) {
  const lines = [
    '📋 LeadPop Funnel Quiz Answers',
    '═══════════════════════════════',
    '',
    `🏦 Loan Types: ${answers.loanTypes?.join(', ') || 'Not answered'}`,
    `📊 Monthly Volume: ${answers.monthlyVolume || 'Not answered'}`,
    `📍 Current Lead Source: ${answers.currentSource || 'Not answered'}`,
    '',
    `🔢 Funnel Step Reached: ${step || 'Unknown'}`,
    `📅 Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
  ];

  return lines.join('\n');
}

function generateTagsFromAnswers(answers) {
  const tags = ['leadpop-funnel'];

  if (answers.monthlyVolume) {
    const vol = answers.monthlyVolume;
    if (vol === '500+' || vol === '250-500') {
      tags.push('high-volume');
    } else if (vol === '100-250' || vol === '50-100') {
      tags.push('mid-volume');
    } else {
      tags.push('low-volume');
    }
  }

  if (answers.loanTypes?.length) {
    for (const type of answers.loanTypes) {
      const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      tags.push(slug);
    }
  }

  return tags;
}

module.exports = {
  setupCustomFields,
  getCustomFields,
  createOrUpdateContact,
  addContactNote,
  addContactTags,
  formatNoteFromAnswers,
  generateTagsFromAnswers,
};
