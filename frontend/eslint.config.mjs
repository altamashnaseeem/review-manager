import nextVitals from 'eslint-config-next/core-web-vitals';
const config = [
  ...nextVitals,
  // Browser state is hydrated in effects; request-version refs intentionally reject stale responses.
  // React Compiler is not enabled for this app. Keep the standard hook safety rules.
  { rules: { 'react-hooks/set-state-in-effect': 'off', 'react-hooks/refs': 'off' } },
  // The HTTP interceptor deliberately reloads outside React after invalidating a session.
  { files: ['lib/axios.js'], rules: { '@next/next/no-location-assign-relative-destination': 'off' } },
  { ignores: ['.next/**', 'node_modules/**'] },
];
export default config;
