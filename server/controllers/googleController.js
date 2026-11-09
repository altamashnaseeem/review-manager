import { createHash, randomBytes } from 'node:crypto';
import Business from '../models/Business.js';
import { BUSINESS_SCOPE, demoEnabled, fail, getOAuthClient, listGoogleLocations, saveTokens } from '../services/googleServices.js';
import { syncBusinessReviews } from '../services/reviewSync.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const ownedBusiness = req => Business.findOne({ _id: req.params.id, owner: req.user.id });
const frontendRedirect = (res, values) => res.redirect(`${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/connect-google?${new URLSearchParams(values)}`);

export async function getGoogleAuthUrl(req, res, next) {
  try {
    const business = await ownedBusiness(req);
    if (!business) throw fail('Business not found', 404);
    if (business.isDemo) throw fail('Create a separate business to connect a real Google account.');
    const client = getOAuthClient();
    const state = randomBytes(32).toString('hex');
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    business.googleOAuthStateHash = hash(state);
    business.googleOAuthExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await business.save();
    const url = client.generateAuthUrl({
      access_type: 'offline', prompt: 'consent', scope: [BUSINESS_SCOPE], state,
      code_challenge: codeChallenge, code_challenge_method: 'S256',
    });
    // The verifier stays in this browser's sessionStorage, never in a redirect URL.
    res.set('Cache-Control', 'no-store').json({ success: true, url, codeVerifier });
  } catch (error) { next(error); }
}

// Google cannot send the app's JWT. Relay the code to the frontend; exchange it
// only in completeGoogleConnection after authenticating the original owner + PKCE.
export async function handleGoogleCallback(req, res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  try {
    const { state, code, error } = req.query;
    if (typeof state !== 'string') return frontendRedirect(res, { error: 'invalid_state' });
    const business = await Business.findOne({ googleOAuthStateHash: hash(state), googleOAuthExpiresAt: { $gt: new Date() } });
    if (!business) return frontendRedirect(res, { error: 'invalid_state' });
    if (error) return frontendRedirect(res, { business: business.id, error: error === 'access_denied' ? 'access_denied' : 'oauth_failed' });
    if (typeof code !== 'string') return frontendRedirect(res, { business: business.id, error: 'oauth_failed' });
    return frontendRedirect(res, { business: business.id, code, state });
  } catch { return frontendRedirect(res, { error: 'oauth_failed' }); }
}
export async function completeGoogleConnection(req, res, next) {
  try {
    const { code, state, codeVerifier } = req.body;
    if (![code, state, codeVerifier].every(v => typeof v === 'string' && v.length > 0)) throw fail('Missing OAuth code, state, or browser verifier. Restart the connection.');
    // Atomically consume a state once, scoped to the authenticated business owner.
    const business = await Business.findOneAndUpdate({
      _id: req.params.id, owner: req.user.id,
      googleOAuthStateHash: hash(state), googleOAuthExpiresAt: { $gt: new Date() },
    }, { $unset: { googleOAuthStateHash: 1, googleOAuthExpiresAt: 1 } }, { new: true }).select('+googleRefreshToken');
    if (!business) throw fail('Invalid or expired Google connection. Start again.', 400);
    const client = getOAuthClient();
    let tokens;
    try { ({ tokens } = await client.getToken({ code, codeVerifier })); }
    catch { throw fail('Google authorization failed. Start the connection again.', 400); }
    if (!tokens.scope?.split(' ').includes(BUSINESS_SCOPE)) throw fail('Grant permission to manage your Business Profile and try again.', 403);
    // Do not reuse a refresh token from a different Google identity on reconnect.
    if (!tokens.refresh_token) throw fail('Google did not return offline access. Remove the app from Google permissions and reconnect.', 409);
    business.googleAuthorized = true;
    business.googleConnected = false;
    business.reviewsSynced = false;
    await saveTokens(business, tokens);
    res.json({ success: true, business });
  } catch (error) { next(error); }
}
export async function getGoogleLocations(req, res, next) {
  try {
    const business = await ownedBusiness(req);
    if (!business) throw fail('Business not found', 404);
    if (!business.googleAuthorized || business.isDemo) throw fail('Connect your Google account first.', 409);
    const locations = await listGoogleLocations(business);
    res.json({ success: true, locations });
  } catch (error) { next(error); }
}
export async function selectGoogleLocation(req, res, next) {
  try {
    const business = await ownedBusiness(req);
    if (!business) throw fail('Business not found', 404);
    if (!business.googleAuthorized || business.isDemo) throw fail('Connect your Google account first.', 409);
    const location = (await listGoogleLocations(business)).find(l => l.accountId === req.body.accountId && l.locationId === req.body.locationId);
    if (!location) throw fail('Choose a location managed by the connected Google account.', 403);
    if (business.googleLocationId && business.googleLocationId !== location.locationId) throw fail('This business is linked to another location. Add a new business for this location.');
    business.googleAccountId = location.accountId;
    business.googleLocationId = location.locationId;
    business.googleResourceName = `locations/${location.locationId}`;
    business.name = location.title;
    if (location.placeId) business.googlePlaceId = location.placeId;
    business.googleConnected = true;
    await business.save();
    // A failing initial import leaves onboarding open and can be retried.
    await syncBusinessReviews(business, { notify: false });
    res.json({ success: true, business });
  } catch (error) { next(error); }
}
export async function connectDemo(req, res, next) {
  try {
    if (!demoEnabled()) throw fail('Development demo is disabled.', 404);
    const business = await ownedBusiness(req);
    if (!business) throw fail('Business not found', 404);
    if (business.googleAuthorized || (business.googleLocationId && !business.isDemo)) throw fail('Use a new business for demo testing.');
    business.isDemo = true;
    business.googleConnected = true;
    business.googleAccountId = 'demo';
    business.googleLocationId = `demo-${business.id}`;
    await business.save();
    await syncBusinessReviews(business, { notify: false });
    res.json({ success: true, business });
  } catch (error) { next(error); }
}
export async function syncReviews(req, res, next) {
  try {
    const business = await ownedBusiness(req);
    if (!business) throw fail('Business not found', 404);
    await syncBusinessReviews(business, { notify: true });
    res.json({ success: true, business });
  } catch (error) { next(error); }
}
