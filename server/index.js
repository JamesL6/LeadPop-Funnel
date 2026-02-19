require('dotenv').config();
const express = require('express');
const cors = require('cors');

const trackRoutes = require('./routes/track');
const ghlRoutes = require('./routes/ghl');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

app.set('trust proxy', true);

app.use('/api/track', trackRoutes);
app.use('/api/ghl', ghlRoutes);

app.get('/health', (req, res) => {
  const config = {
    meta_capi: !!(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    ga4: !!(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET),
    ghl: !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID),
  };

  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    integrations: config,
  });
});

app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Server] LeadPop tracking server running on port ${PORT}`);
  console.log(`[Server] Meta CAPI: ${process.env.META_PIXEL_ID ? 'configured' : 'NOT configured'}`);
  console.log(`[Server] GA4: ${process.env.GA4_MEASUREMENT_ID ? 'configured' : 'NOT configured'}`);
  console.log(`[Server] GHL: ${process.env.GHL_API_KEY ? 'configured' : 'NOT configured'}`);
});
