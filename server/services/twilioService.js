import twilio from 'twilio';

export function normalizeWhatsAppNumber(value) {
  const number = String(value || '').replace(/^whatsapp:/, '').replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(number)) throw new Error('Use a WhatsApp number with its country code, for example +919876543210.');
  return `whatsapp:${number}`;
}

export function buildWhatsAppAlert({ to, businessName, reviewerName, rating, comment, replyLink, aiSuggestedReply }) {
  const from = normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_NUMBER);
  const recipient = normalizeWhatsAppNumber(to);
  const name = String(businessName).slice(0, 80);
  const reviewer = String(reviewerName || 'Anonymous').slice(0, 80);
  const review = String(comment || 'No written comment').slice(0, 500);
  const contentSid = process.env.TWILIO_REVIEW_ALERT_CONTENT_SID;
  if (contentSid) {
    return { from, to: recipient, contentSid, contentVariables: JSON.stringify({
      1: name, 2: reviewer, 3: String(rating), 4: review, 5: replyLink,
    }) };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Configure an approved TWILIO_REVIEW_ALERT_CONTENT_SID for production WhatsApp alerts.');
  return { from, to: recipient, body: [
    `New ${rating}-star review for ${name}`,
    `Customer: ${reviewer}`, review,
    aiSuggestedReply ? `AI draft: ${aiSuggestedReply.slice(0, 450)}` : 'AI draft is unavailable. You can write a reply or generate one in the app.',
    'Review and approve your reply in the app. Nothing is posted before you approve:', replyLink,
  ].join('\n\n') };
}

export async function sendWhatsAppAlert(details) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_NUMBER) {
    throw new Error('Configure Twilio credentials and a WhatsApp sender on the server.');
  }
  const message = buildWhatsAppAlert(details);
  // Create lazily: dotenv has loaded before any scheduled notification is sent.
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, { timeout: 15000, autoRetry: false });
  try {
    const result = await client.messages.create(message);
    return { sid: result.sid, status: result.status };
  } catch {
    // Provider error objects can contain request credentials and phone numbers.
    throw new Error('Twilio could not accept the WhatsApp alert. Check sender, recipient sandbox enrollment, templates, and Twilio message logs.');
  }
}
