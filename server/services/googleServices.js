import { google } from 'googleapis';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import Business from '../models/Business.js';
import { demoReviewPage } from '../fixtures/googleBusiness.js';

export const BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';
export const demoEnabled = () => process.env.NODE_ENV === 'development' && process.env.GOOGLE_BUSINESS_MOCK === 'true';
export const demoWhatsAppEnabled = () => demoEnabled() && process.env.DEMO_WHATSAPP_ENABLED === 'true';
export const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function encryptionKey() {
  const key = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw fail('Configure GOOGLE_TOKEN_ENCRYPTION_KEY as a base64 encoded 32-byte key.', 503);
  return key;
}
export function encryptToken(value) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}
export function decryptToken(value) {
  if (!value) return undefined;
  // Existing plaintext credentials are read once and encrypted on the next refresh/reconnect.
  if (!value.startsWith('v1:')) return value;
  const [, iv, tag, data] = value.split(':');
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8');
}
export function getOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    throw fail('Google OAuth is not configured on the server.', 503);
  }
  encryptionKey();
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}
export async function saveTokens(business, tokens) {
  if (tokens.access_token) business.googleAccessToken = encryptToken(tokens.access_token);
  if (tokens.refresh_token) business.googleRefreshToken = encryptToken(tokens.refresh_token);
  if (tokens.expiry_date) business.googleTokenExpiry = new Date(tokens.expiry_date);
  await business.save();
}
export async function googleRequest(business, options) {
  const credentials = await Business.findById(business._id).select('+googleAccessToken +googleRefreshToken');
  if (!credentials?.googleRefreshToken) throw fail('Reconnect your Google Business account.', 409);
  const client = getOAuthClient();
  client.setCredentials({
    access_token: decryptToken(credentials.googleAccessToken),
    refresh_token: decryptToken(credentials.googleRefreshToken),
    expiry_date: credentials.googleTokenExpiry?.getTime(),
  });
  try {
    // OAuth2Client refreshes expired access tokens and retries an unauthorized request.
    const response = await client.request({ ...options, timeout: 30000 });
    await saveTokens(credentials, client.credentials);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (error.response?.data?.error === 'invalid_grant' || status === 401) {
      await Business.updateOne({ _id: business._id }, { googleConnected: false });
      throw fail('Google access expired or was revoked. Reconnect your Google Business account.', 409);
    }
    if (status === 403) throw fail('Google denied access. Check Business Profile API approval, quota, and your permission to manage this verified location.', 403);
    if (status === 429) throw fail('Google API quota exceeded. Try syncing again later.', 429);
    throw fail('Google Business Profile request failed. Check API setup and retry.', 502);
  }
}

// No fixed page limit: follow every nextPageToken for accounts, locations, and reviews.
export async function collectPages(loadPage, field) {
  let pageToken;
  const items = [];
  const seen = new Set();
  do {
    const page = await loadPage(pageToken);
    items.push(...(page[field] || []));
    pageToken = page.nextPageToken;
    if (pageToken && seen.has(pageToken)) throw fail('Google returned a repeated pagination token.', 502);
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return items;
}
export async function listGoogleLocations(business, request = googleRequest) {
  const accounts = await collectPages(pageToken => request(business, {
    url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts', params: { pageSize: 20, pageToken },
  }), 'accounts');
  const result = [];
  for (const account of accounts) {
    const locations = await collectPages(pageToken => request(business, {
      url: `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      params: { readMask: 'name,title,storefrontAddress,metadata', pageSize: 100, pageToken },
    }), 'locations');
    for (const location of locations) {
      result.push({
        accountId: account.name.split('/').pop(), locationId: location.name.split('/').pop(),
        title: location.title, accountName: account.accountName,
        address: (location.storefrontAddress?.addressLines || []).join(', '),
        placeId: location.metadata?.placeId,
      });
    }
  }
  return result;
}
export async function fetchBusinessReviews(business, request = googleRequest) {
  if (!business.googleConnected || !business.googleAccountId || !business.googleLocationId) {
    throw fail('Connect Google Business and choose a location before fetching reviews.', 409);
  }
  if (business.isDemo && !demoEnabled()) throw fail('Development demo is disabled.', 403);
  let summary;
  const reviews = await collectPages(async pageToken => {
    const page = business.isDemo ? demoReviewPage(business._id, pageToken) : await request(business, {
      url: `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(business.googleAccountId)}/locations/${encodeURIComponent(business.googleLocationId)}/reviews`,
      params: { pageSize: 50, orderBy: 'updateTime desc', pageToken },
    });
    summary ||= page;
    return page;
  }, 'reviews');
  const ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return {
    overallRating: summary.averageRating || 0, totalReviews: summary.totalReviewCount || 0,
    reviews: reviews.map(r => ({
      googleReviewId: r.reviewId, reviewerName: r.reviewer?.displayName || 'Anonymous',
      reviewerPhoto: r.reviewer?.profilePhotoUrl || null, rating: ratings[r.starRating],
      comment: r.comment || '', reviewDate: new Date(r.createTime),
      googleUpdatedAt: new Date(r.updateTime || r.createTime),
      ...(r.reviewReply ? { finalReply: r.reviewReply.comment, replyStatus: 'posted', repliedAt: new Date(r.reviewReply.updateTime) } : {}),
    })),
  };
}
export async function postReplyToGoogle(business, reviewId, replyText) {
  if (!business.googleConnected) throw fail('Connect your Google Business account first.', 409);
  if (business.isDemo) {
    if (!demoEnabled()) throw fail('Development demo is disabled.', 403);
    return { simulated: true };
  }
  await googleRequest(business, {
    url: `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(business.googleAccountId)}/locations/${encodeURIComponent(business.googleLocationId)}/reviews/${encodeURIComponent(reviewId)}/reply`,
    method: 'PUT', data: { comment: replyText },
  });
  return { simulated: false };
}
