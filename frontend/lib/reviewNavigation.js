// Restrict post-login redirects to known application pages.
export function loginDestination(search) {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/connect-google';
  const url = new URL(next, 'https://app.invalid');
  return ['/reviews', '/dashboard', '/settings', '/connect-google'].includes(url.pathname)
    ? `${url.pathname}${url.search}` : '/connect-google';
}
