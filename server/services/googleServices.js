import logger from '../utils/logger.js';

const GOOGLE_MY_BUSINESS_API = 'https://mybusiness.googleapis.com/v4';

const fetchPlaceReviews = async (placeId) => {
  try {
    console.log('Fetching reviews for place:', placeId);

    const url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&api_key=${process.env.SERPAPI_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    console.log('SerpApi response status:', response.status);

    if (!response.ok || data.error) {
      throw new Error(`SerpApi error: ${data.error || 'Unknown error'}`);
    }

    const reviews = (data.reviews || []).map((r) => ({
      googleReviewId: `${placeId}_${r.iso_date}`,
      reviewerName: r.user?.name || 'Anonymous',
      reviewerPhoto: r.user?.thumbnail || null,
      rating: r.rating,
      comment: r.snippet || '',
      reviewDate: new Date(r.iso_date),
    }));

    return {
      name: data.place_info?.title || 'Unknown',
      overallRating: data.place_info?.rating || 0,
      totalReviews: data.place_info?.reviews || 0,
      reviews,
    };
  } catch (error) {
    logger.error('SerpApi fetch error:', error.message);
    throw error;
  }
};

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