const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

const EVENT_MAP = {
  page_view:       'page_view',
  quiz_started:    'begin_checkout',
  quiz_answer:     'quiz_answer',
  quiz_completed:  'generate_lead',
  calendar_view:   'calendar_view',
  booking_created: 'purchase',
  quiz_rejected:   'quiz_disqualified',
};

async function sendEvent(payload) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.warn('[GA4] Skipped — missing MEASUREMENT_ID or API_SECRET');
    return null;
  }

  const gaEventName = EVENT_MAP[payload.event_name] || payload.event_name;

  const params = {
    funnel_step: payload.step,
    engagement_time_msec: '1',
  };

  if (payload.answers) {
    if (payload.answers.loanTypes?.length) {
      params.loan_types = payload.answers.loanTypes.join(', ');
    }
    if (payload.answers.monthlyVolume) {
      params.monthly_volume = payload.answers.monthlyVolume;
    }
    if (payload.answers.currentSource) {
      params.current_source = payload.answers.currentSource;
    }
  }

  if (payload.question) params.question = payload.question;
  if (payload.answer_value) params.answer_value = payload.answer_value;

  const body = {
    client_id: payload.ga_client_id || payload.session_id || 'anonymous',
    non_personalized_ads: false,
    events: [
      {
        name: gaEventName,
        params,
      },
    ],
  };

  if (payload.user_id) {
    body.user_id = payload.user_id;
  }

  try {
    const url = `${GA4_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 204 || res.ok) {
      console.log(`[GA4] Sent "${gaEventName}" (step ${payload.step})`);
      return { success: true };
    }

    const text = await res.text();
    console.error('[GA4] Error:', res.status, text);
    return { error: text };
  } catch (err) {
    console.error('[GA4] Network error:', err.message);
    return { error: err.message };
  }
}

module.exports = { sendEvent };
