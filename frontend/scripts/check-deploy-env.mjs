import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
try {
  const url = new URL(process.env.NEXT_PUBLIC_API_URL);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/api')) throw new Error();
  console.log('Frontend deployment API URL is configured.');
} catch { console.error('Set NEXT_PUBLIC_API_URL to your public HTTPS backend URL ending in /api before deployment.'); process.exit(1); }
