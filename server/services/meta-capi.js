const crypto = require('crypto');

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function hashSHA256(value) {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

const EVENT_MAP = {
  page_view:       { eventName: 'ViewContent',  actionSource: 'website' },
  quiz_started:    { eventName: 'InitiateCheckout', actionSource: 'website' },
  quiz_answer:     { eventName: 'CustomizeProduct', actionSource: 'website' },
  quiz_completed:  { eventName: 'Lead',         actionSource: 'website' },
  calendar_view:   { eventName: 'Contact',      actionSource: 'website' },
  booking_created: { eventName: 'Purchase',     actionSource: 'website' },
  quiz_rejected:   { eventName: 'ViewContent',  actionSource: 'website' },
};

async function sendEvent(payload) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('[Meta CAPI] Skipped — missing PIXEL_ID or ACCESS_TOKEN');
    return null;
  }

  const mapping = EVENT_MAP[payload.event_name];
  if (!mapping) {
    console.log(`[Meta CAPI] Skipped "${payload.event_name}" — no mapping, not a tracked event`);
    return null;
  }

  const userData = {};

  if (payload.fbp) userData.fbp = payload.fbp;
  if (payload.fbc) userData.fbc = payload.fbc;
  if (payload.client_ip) userData.client_ip_address = payload.client_ip;
  if (payload.client_user_agent) userData.client_user_agent = payload.client_user_agent;

  if (payload.email) userData.em = [hashSHA256(payload.email)];
  if (payload.phone) userData.ph = [hashSHA256(payload.phone)];
  if (payload.first_name) userData.fn = [hashSHA256(payload.first_name)];
  if (payload.last_name) userData.ln = [hashSHA256(payload.last_name)];

  const eventData = {
    event_name: mapping.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: mapping.actionSource,
    event_source_url: payload.source_url || undefined,
    event_id: payload.event_id,
    user_data: userData,
    custom_data: {},
  };

  if (payload.answers) {
    eventData.custom_data.loan_types = payload.answers.loanTypes?.join(', ') || '';
    eventData.custom_data.monthly_volume = payload.answers.monthlyVolume || '';
    eventData.custom_data.current_source = payload.answers.currentSource || '';
  }

  if (payload.step !== undefined) {
    eventData.custom_data.funnel_step = payload.step;
  }

  if (payload.event_name === 'quiz_completed') {
    eventData.custom_data.value = 1;
    eventData.custom_data.currency = 'USD';
  }

  const body = {
    data: [eventData],
    ...(process.env.META_TEST_EVENT_CODE && {
      test_event_code: process.env.META_TEST_EVENT_CODE,
    }),
  };

  try {
    const url = `${GRAPH_API_BASE}/${pixelId}/events?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('[Meta CAPI] Error:', JSON.stringify(result));
      return { error: result };
    }

    console.log(`[Meta CAPI] Sent "${mapping.eventName}" (step ${payload.step}) — events_received: ${result.events_received}`);
    return result;
  } catch (err) {
    console.error('[Meta CAPI] Network error:', err.message);
    return { error: err.message };
  }
}

module.exports = { sendEvent };
