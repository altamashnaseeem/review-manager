import twilio from 'twilio';
import logger from '../utils/logger.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendWhatsAppAlert = async ({ to, businessName, reviewerName, rating, comment, replyLink }) => {
  try {
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
      to: `whatsapp:${to}`,
      body: message,
    });

    logger.info(`WhatsApp alert sent to ${to} for ${businessName}`);
    return true;
  } catch (error) {
    logger.error('Twilio WhatsApp error:', error.message);
    throw error;
  }
};

export { sendWhatsAppAlert };
