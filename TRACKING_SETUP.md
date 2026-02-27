# LeadPop Tracking Integration — Setup Documentation

**Last Updated:** February 20, 2026  
**Status:** Phases 1–6 Complete | Phase 7 QA In Progress

---

## Architecture Overview

```
Browser (apply.leadpop.io)
    ├── Meta Pixel (browser-side fbq() calls)
    ├── GTM (dataLayer.push for GA4 events)
    ├── localStorage (partial progress saves)
    └── sendBeacon → Railway Server (every step)

Railway Server (leadpop-funnel-server-production.up.railway.app)
    ├── POST /api/track → Meta CAPI + GA4 Measurement Protocol
    ├── POST /api/ghl/setup-fields → one-time GHL field creation
    └── POST /api/ghl/booking-webhook → GHL contact enrichment

GHL Calendar (booking widget iframe)
    └── On booking → redirect to apply.leadpop.io/booking-confirmed

Booking Confirmation Page (apply.leadpop.io/booking-confirmed)
    ├── Reads localStorage for quiz answers + session
    ├── Fires fbq('track', 'Schedule') with event_id
    ├── sendBeacon to Railway → Meta CAPI Schedule event
    └── GTM dataLayer push (schedule_booked)

GHL Workflow: LeadPop - Booking Enrichment
    └── Trigger: Customer Booked Appointment
        ├── Wait 1 minute
        ├── Add Note (quiz answers from custom fields)
        └── Add Tag: leadpop-funnel
```

---

## Event Hierarchy (Meta Pixel + CAPI)

| Funnel Step | Internal Event | Meta Event | Notes |
|---|---|---|---|
| Page load | `page_view` | `ViewContent` | First touch |
| Quiz start (screen 5) | `quiz_started` | `InitiateCheckout` | |
| Each quiz answer | `quiz_answer` | `CustomizeProduct` | Fires 3x |
| Quiz completed | `quiz_completed` | `Lead` | Key conversion |
| Calendar reached | `calendar_view` | `Contact` | Intent signal |
| Call booked | `booking_created` | `Schedule` | Primary conversion — fires from confirmation page |
| Quiz rejected | `quiz_rejected` | (skipped in Meta) | GA4 only |

All events sent via both browser pixel AND Railway CAPI with matching `event_id` for deduplication.

---

## Phase 1: Railway Credentials ✅

All environment variables set on Railway:

| Variable | Description |
|---|---|
| `META_PIXEL_ID` | `2123621785138978` |
| `META_ACCESS_TOKEN` | CAPI access token for dataset |
| `META_TEST_EVENT_CODE` | `TEST21746` — **remove after QA** |
| `GA4_MEASUREMENT_ID` | `G-2J2R37S1BK` |
| `GA4_API_SECRET` | Measurement Protocol API secret |
| `GHL_API_KEY` | Private integration key |
| `GHL_LOCATION_ID` | `Z39fcvvUEegsnLnyNTJE` |
| `SETUP_SECRET` | `lp-setup-2026` |
| `ALLOWED_ORIGINS` | `https://leadpop.io,https://www.leadpop.io,https://apply.leadpop.io` |

Health check: `https://leadpop-funnel-server-production.up.railway.app/health`  
Expected: `{"status":"ok","integrations":{"meta_capi":true,"ga4":true,"ghl":true}}`

---

## Phase 2: GHL Custom Fields + Calendar ✅

**Custom fields created via API** (`POST /api/ghl/setup-fields`):

| Field Name | Field Key | ID |
|---|---|---|
| Loan Types | `contact.loan_types` | `CQAGt3yGdxk2Z3U4HpKh` |
| Monthly Volume | `contact.monthly_volume` | `UrM0Yv8am71DNOKiHQH5` |
| Current Source | `contact.current_source` | `QfIWgdaML1irtCwNjTwQ` |
| Funnel Answers | `contact.funnel_answers` | `dNgy4WmM2d6dsQt5Wfc9` |
| Funnel Step Reached | `contact.funnel_step_reached` | `XauyPCJxxgrsOFxPlSzr` |

**Calendar:** URL params (`?loan_types=...&monthly_volume=...&current_source=...`) passed via iframe src.  
**Redirect URL:** `https://apply.leadpop.io/booking-confirmed?cid={{contact.id}}` *(pending update)*

---

## Phase 3: GHL Booking Enrichment Workflow ✅

**Workflow:** `LeadPop - Booking Enrichment`  
**Trigger:** Customer Booked Appointment  
**Actions:**
1. Wait — 1 minute
2. Add Note — formatted quiz answers using `{{contact.loan_types}}` etc.
3. Add Tag — `leadpop-funnel`

**Note:** Meta CAPI action was removed — Schedule event now handled by confirmation page.

---

## Phase 4: Meta Events Manager ✅

**Custom Conversions:**
- `LP - Quiz Started` → Initiate Checkout, URL contains `apply.leadpop.io`
- `LP - Quiz Completed` → Lead, URL contains `apply.leadpop.io`
- `LP - Call Booked` → Schedule, URL contains `apply.leadpop.io`

**Retargeting Audiences:**
- `LP - All Funnel Visitors` → ViewContent, 30 days
- `LP - Quiz Dropoffs` → Include InitiateCheckout, Exclude Lead, 14 days
- `LP - Calendar Dropoffs` → Include Lead, Exclude Schedule, 14 days
- `LP - Booked Calls` → Schedule, 180 days (seed for lookalikes)

**Lookalike Audiences** (from LP - Booked Calls, US):
- 1%, 2%, 3% lookalikes

---

## Phase 5: GA4 ✅ (partial — 24-48h follow-up needed)

**Property:** LeadPop Website (`G-2J2R37S1BK`)  
**Data Stream:** leadpop.io (covers all subdomains)  
**API Secret:** `UVXpKS4AQUeurx7OSBGBBg`

**Key Events to mark** *(do in 24-48h when events appear in Admin → Events)*:
- `generate_lead` ⏳
- `calendar_view` ⏳
- `purchase` ✅ (already marked — GA4 default)

**Funnel Exploration:** `LeadPop Funnel Drop-off`
- Step 1: `page_view`
- Step 2: `begin_checkout`
- Step 3: `quiz_answer`
- Step 4: `generate_lead`
- Step 5: `calendar_view`
- Step 6: `schedule_view` *(update to `purchase` once event populates)* ⏳

---

## Phase 6: GTM ✅

**Container:** `GTM-NJ6DWBPB` — Version 2 published Feb 20, 2026

**Data Layer Variables:**
- `dlv - event_id` → `event_id`
- `dlv - quiz_answers` → `quiz_answers`
- `dlv - quiz_current_step` → `quiz_current_step`
- `dlv - answer_value` → `answer_value`
- `dlv - question` → `question`

**Triggers (Custom Events):**
- `CE - quiz_started`, `CE - quiz_answer`, `CE - quiz_completed`
- `CE - calendar_view`, `CE - quiz_rejected`, `CE - schedule_booked`

**GA4 Event Tags:**
- `GA4 - Quiz Started` → `begin_checkout` → CE - quiz_started
- `GA4 - Quiz Answer` → `quiz_answer` (+ question, answer_value) → CE - quiz_answer
- `GA4 - Quiz Completed` → `generate_lead` → CE - quiz_completed
- `GA4 - Calendar View` → `calendar_view` → CE - calendar_view
- `GA4 - Quiz Rejected` → `quiz_disqualified` → CE - quiz_rejected
- `GA4 - Schedule Booked` → `schedule_booked` → CE - schedule_booked

---

## Phase 7: QA Testing Status

| Test | Status | Notes |
|---|---|---|
| Test 1: Railway API isolation | ✅ PASS | `meta: events_received:1, ga4: success:true` |
| Test 2: Meta CAPI events | ✅ PASS | All 5 standard events firing, no quiz_step noise |
| Test 3: Meta Pixel Helper | ✅ PASS | All events firing with eventID for dedup, fbp cookie present |
| Test 4: GA4 Realtime | ✅ PASS | All events visible, purchase showing as Key Event |
| Test 5: GTM Debug | ✅ PASS | 5 GA4 tags fired correctly |
| Test 6: localStorage | ✅ PASS | Quiz answers persist and read correctly on confirmation page |
| Test 7: GHL Calendar URL Params | ⚠️ IN PROGRESS | Params passed in iframe URL but not saving to contact — fix pending |
| Test 8: GHL Contact Custom Fields | ⚠️ IN PROGRESS | Fields empty — fix pending (contact_id via redirect URL) |
| Test 9: GHL Workflow Execution | ⚠️ PARTIAL | Notes added but empty values; tags not applying |
| Test 10: Deduplication | ⏳ PENDING | |
| Test 11: Railway Server Logs | ⏳ PENDING | |

---

## Pending Items

- [ ] **GHL contact fields fix** — Update calendar redirect to `?cid={{contact.id}}`, update confirmation page + Railway webhook to write quiz answers to contact via API
- [ ] **GHL tags fix** — Pre-create `leadpop-funnel` tag in GHL so workflow can apply it
- [ ] **Record confirmation video** — 45-second Hormozi-style video for `booking-confirmed.html`
- [ ] **GA4 Key Events** — Mark `generate_lead` and `calendar_view` as Key Events (check in 24-48h)
- [ ] **GA4 Funnel** — Update step 6 from `schedule_view` to `purchase` (check in 24-48h)
- [ ] **Phase 8** — Remove `META_TEST_EVENT_CODE` from Railway, delete test contacts, 24h live data check

---

## File Reference

| File | Purpose |
|---|---|
| `index.html` | Funnel — Meta Pixel, trackEvent(), fbq(), localStorage, calendar URL params |
| `booking-confirmed.html` | Confirmation page — Schedule event, FAQ, video placeholder |
| `server/index.js` | Express server — CORS, routing, health check |
| `server/services/meta-capi.js` | Meta CAPI — server-side events, EVENT_MAP |
| `server/services/ga4.js` | GA4 Measurement Protocol |
| `server/services/ghl.js` | GHL API — custom fields, contacts, notes, tags |
| `server/routes/track.js` | POST /api/track |
| `server/routes/ghl.js` | POST /api/ghl/setup-fields + booking-webhook |
| `server/.env.example` | All environment variables documented |
