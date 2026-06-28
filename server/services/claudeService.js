import logger from '../utils/logger.js';

const generateReviewReply = async (review, businessName) => {
  try {
    const prompt = `You are a professional business reputation manager for "${businessName}".

A customer left the following ${review.rating}-star review:
"${review.comment}"

Write a professional, empathetic reply under 100 words.
If bad review (1-3 stars): apologize sincerely, invite them back.
If good review (4-5 stars): thank them warmly.
Sign off with "Team ${businessName}".
Reply only with the response text, nothing else.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();

    logger.info(`AI reply generated for review from ${review.reviewerName}`);
    return reply;
  } catch (error) {
    logger.error('Groq API error:', error.message);
    throw new Error('Failed to generate AI reply');
  }
};

export { generateReviewReply };