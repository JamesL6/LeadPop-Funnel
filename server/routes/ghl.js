const express = require('express');
const ghl = require('../services/ghl');

const router = express.Router();

/**
 * POST /api/ghl/setup-fields
 * One-time call to create custom fields in GHL via API.
 * Protected by a simple shared secret.
 */
router.post('/setup-fields', async (req, res) => {
  const secret = req.headers['x-setup-secret'];
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: 'Invalid setup secret' });
  }

  try {
    const results = await ghl.setupCustomFields();
    res.json({ ok: true, fields: results });
  } catch (err) {
    console.error('[GHL Setup] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ghl/booking-webhook
 * Receives a webhook from GHL when an appointment is booked.
 * Enriches the contact with quiz answers, a note, and tags.
 *
 * GHL sends contact data including custom field values that were
 * passed via calendar URL params. This endpoint adds the formatted
 * note and volume-based tags.
 *
 * Expected body (from GHL webhook or manual trigger):
 * {
 *   contact_id: 'ghl-contact-id',
 *   email: 'user@example.com',
 *   answers: { loanTypes: [], monthlyVolume: '', currentSource: '' },
 *   step: 9
 * }
 */
router.post('/booking-webhook', async (req, res) => {
  const { contact_id, email, answers, step } = req.body;

  if (!contact_id && !email) {
    return res.status(400).json({ error: 'contact_id or email is required' });
  }

  const results = {};

  try {
    if (answers) {
      const noteBody = ghl.formatNoteFromAnswers(answers, step);
      const tags = ghl.generateTagsFromAnswers(answers);

      if (contact_id) {
        const [noteResult, tagResult] = await Promise.allSettled([
          ghl.addContactNote(contact_id, noteBody),
          ghl.addContactTags(contact_id, tags),
        ]);

        results.note = noteResult.status === 'fulfilled' ? noteResult.value : { error: noteResult.reason?.message };
        results.tags = tagResult.status === 'fulfilled' ? tagResult.value : { error: tagResult.reason?.message };
      }

      if (email) {
        const customFields = [];

        const fieldMappings = {
          loan_types: answers.loanTypes?.join(', ') || '',
          monthly_volume: answers.monthlyVolume || '',
          current_source: answers.currentSource || '',
          funnel_answers: JSON.stringify(answers),
          funnel_step_reached: String(step || 9),
        };

        for (const [key, value] of Object.entries(fieldMappings)) {
          if (value) customFields.push({ key, field_value: value });
        }

        const contactResult = await ghl.createOrUpdateContact({
          email,
          customFields,
          tags: ghl.generateTagsFromAnswers(answers),
        });

        results.contact = contactResult;
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('[GHL Webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
