const express = require('express');
const metaCapi = require('../services/meta-capi');
const ga4 = require('../services/ga4');

const router = express.Router();

/**
 * POST /api/track
 *
 * Receives funnel events from the browser and fans out to:
 *   1. Meta Conversions API (server-side pixel)
 *   2. GA4 Measurement Protocol (server-side analytics)
 *
 * Expected body:
 * {
 *   event_name: 'page_view' | 'quiz_started' | 'quiz_answer' | 'quiz_completed' | 'calendar_view' | 'quiz_rejected',
 *   step: 1-9,
 *   event_id: 'uuid',             // for pixel deduplication
 *   session_id: 'uuid',           // persistent per-session
 *   source_url: 'https://...',
 *   fbp: '_fbp cookie',
 *   fbc: '_fbc cookie or built from fbclid',
 *   ga_client_id: 'GA _ga cookie',
 *   answers: { loanTypes: [], monthlyVolume: '', currentSource: '' },
 *   question: 'q1',               // only for quiz_answer events
 *   answer_value: 'MCA, SBA',     // only for quiz_answer events
 * }
 */
router.post('/', async (req, res) => {
  const payload = req.body;

  if (!payload || !payload.event_name) {
    return res.status(400).json({ error: 'event_name is required' });
  }

  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress;

  const clientUserAgent = req.headers['user-agent'] || '';

  const enriched = {
    ...payload,
    client_ip: clientIp,
    client_user_agent: clientUserAgent,
  };

  const results = {};

  const [metaResult, ga4Result] = await Promise.allSettled([
    metaCapi.sendEvent(enriched),
    ga4.sendEvent(enriched),
  ]);

  results.meta = metaResult.status === 'fulfilled' ? metaResult.value : { error: metaResult.reason?.message };
  results.ga4 = ga4Result.status === 'fulfilled' ? ga4Result.value : { error: ga4Result.reason?.message };

  console.log(`[Track] ${payload.event_name} (step ${payload.step}) — session: ${payload.session_id?.slice(0, 8)}`);

  res.json({ ok: true, results });
});

module.exports = router;
