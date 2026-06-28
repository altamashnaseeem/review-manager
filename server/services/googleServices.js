import logger from '../utils/logger.js';

const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place';
const GOOGLE_MY_BUSINESS_API = 'https://mybusiness.googleapis.com/v4';

// Fetch reviews using Google Places API (public — no auth needed)
const fetchPlaceReviews = async (placeId) => {
  try {
    const url = `${GOOGLE_PLACES_API}/details/json?place_id=${placeId}&fields=name,rating,reviews,user_ratings_total&key=${process.env.GOOGLE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const place = data.result;

    return {
      name: place.name,
      overallRating: place.rating,
      totalReviews: place.user_ratings_total,
      reviews: (place.reviews || []).map((r) => ({
        googleReviewId: `${placeId}_${r.time}`,
        reviewerName: r.author_name,
        reviewerPhoto: r.profile_photo_url || null,
        rating: r.rating,
        comment: r.text || '',
        reviewDate: new Date(r.time * 1000),
      })),
    };
  } catch (error) {
    logger.error('Google Places API fetch error:', error.message);
    throw error;
  }
};

// Post reply to Google review using Google My Business API (requires OAuth)
const postReplyToGoogle = async (business, reviewId, replyText) => {
  try {
    if (!business.googleAccessToken || !business.googleLocationId) {
      throw new Error('Google account not connected for this business');
    }

    const url = `${GOOGLE_MY_BUSINESS_API}/accounts/${business.googleAccountId}/locations/${business.googleLocationId}/reviews/${reviewId}/reply`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${business.googleAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: replyText }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google reply error: ${JSON.stringify(error)}`);
    }

    logger.info(`Reply posted to Google for review ${reviewId}`);
    return true;
  } catch (error) {
    logger.error('Google post reply error:', error.message);
    throw error;
  }
};

export { fetchPlaceReviews, postReplyToGoogle };
