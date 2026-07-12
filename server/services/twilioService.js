import twilio from 'twilio';
import logger from '../utils/logger.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendWhatsAppAlert = async ({ to, businessName, reviewerName, rating, comment, replyLink }) => {
  try {
    // Auto fix phone number — add +91 if missing
    let phone = to.toString().trim();
    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }

    const stars = '⭐'.repeat(rating);
    const message = `⚠️ *New ${rating}-Star Review Alert!*

🏪 *Business:* ${businessName}
👤 *Reviewer:* ${reviewerName}
${stars}

💬 *Review:*
"${comment || 'No comment'}"

🤖 *Claude has written a reply for you!*
Click below to review and post it:
${replyLink}`;

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${phone}`,
      body: message,
    });

    logger.info(`WhatsApp alert sent to ${phone} for ${businessName}`);
    return true;
  } catch (error) {
    logger.error('Twilio WhatsApp error:', error.message);
    return false; // don't crash the poller if alert fails
  }
};

export { sendWhatsAppAlert };