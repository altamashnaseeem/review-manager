export const billingEnabled = (env = process.env) => env.BILLING_ENABLED === 'true';

export function validateEnvironment(env = process.env) {
  const errors = [];
  if (env.NODE_ENV && !['development', 'production', 'test'].includes(env.NODE_ENV)) errors.push('NODE_ENV must be development, production, or test');
  if ((env.RENDER === 'true' || env.RAILWAY_ENVIRONMENT_ID) && env.NODE_ENV !== 'production') errors.push('Render/Railway backends must use NODE_ENV=production; keep development demo switches local');
  const required = name => { if (!env[name]?.trim()) errors.push(`${name} is required`); };
  required('MONGO_URI'); required('JWT_SECRET');
  const port = Number(env.PORT || 5000);
  const interval = Number(env.REVIEW_POLL_INTERVAL_MINUTES || 30);
  const trustProxy = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be between 1 and 65535');
  if (!Number.isInteger(interval) || interval < 1 || interval > 1440) errors.push('REVIEW_POLL_INTERVAL_MINUTES must be a whole number from 1 to 1440');
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) errors.push('TRUST_PROXY_HOPS must be a whole number from 0 to 5');
  for (const flag of ['GOOGLE_BUSINESS_MOCK', 'DEMO_WHATSAPP_ENABLED', 'BILLING_ENABLED', 'RUN_REVIEW_POLLER']) {
    if (env[flag] && !['true', 'false'].includes(env[flag])) errors.push(`${flag} must be true or false`);
  }
  if (env.NODE_ENV === 'production') {
    if (env.GOOGLE_BUSINESS_MOCK === 'true' || env.DEMO_WHATSAPP_ENABLED === 'true') errors.push('Disable GOOGLE_BUSINESS_MOCK and DEMO_WHATSAPP_ENABLED in production');
    if ((env.JWT_SECRET || '').length < 32 || env.JWT_SECRET === 'replace-with-a-long-random-secret') errors.push('JWT_SECRET must be a new random secret of at least 32 characters');
    for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_TOKEN_ENCRYPTION_KEY', 'GROQ_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER', 'TWILIO_REVIEW_ALERT_CONTENT_SID']) required(name);
    const key = env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
    const bytes = Buffer.from(key, 'base64');
    if (bytes.length !== 32 || bytes.toString('base64') !== key) errors.push('GOOGLE_TOKEN_ENCRYPTION_KEY must encode exactly 32 random bytes as base64');
    for (const name of ['FRONTEND_URL', 'GOOGLE_REDIRECT_URI']) {
      try {
        const url = new URL(env[name]);
        if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error();
        if (name === 'FRONTEND_URL' && url.pathname !== '/') throw new Error();
        if (name === 'GOOGLE_REDIRECT_URI' && !url.pathname.endsWith('/api/business/google/callback')) throw new Error();
      } catch { errors.push(`${name} must be a public HTTPS URL with the correct callback path/origin`); }
    }
  }
  if (billingEnabled(env)) {
    for (const name of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_PLAN_MONTHLY_ID', 'RAZORPAY_PLAN_QUARTERLY_ID', 'RAZORPAY_PLAN_SEMI_ANNUAL_ID']) required(name);
    const ids = [env.RAZORPAY_PLAN_MONTHLY_ID, env.RAZORPAY_PLAN_QUARTERLY_ID, env.RAZORPAY_PLAN_SEMI_ANNUAL_ID].filter(Boolean);
    if (new Set(ids).size !== ids.length) errors.push('Razorpay plan IDs must be distinct');
  }
  if (errors.length) throw new Error(`Invalid server configuration:\n${[...new Set(errors)].map(error => `- ${error}`).join('\n')}`);
  return { port, pollIntervalMs: interval * 60000, trustProxy, runPoller: env.RUN_REVIEW_POLLER !== 'false' };
}
