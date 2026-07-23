import logger from '../utils/logger.js';

const GOOGLE_MY_BUSINESS_API = 'https://mybusiness.googleapis.com/v4';

// const fetchPlaceReviews = async (placeId) => {
//   try {
//     console.log('Fetching reviews for place:', placeId);

//   const url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&sort=newestFirst&api_key=${process.env.SERPAPI_KEY}`;


//     const response = await fetch(url);
//     const data = await response.json();
//       console.log("data:::",data)
//     console.log('SerpApi response status:', response.status);

//     if (!response.ok || data.error) {
//       throw new Error(`SerpApi error: ${data.error || 'Unknown error'}`);
//     }

//     const reviews = (data.reviews || []).map((r) => ({
//       googleReviewId: `${placeId}_${r.iso_date}`,
//       reviewerName: r.user?.name || 'Anonymous',
//       reviewerPhoto: r.user?.thumbnail || null,
//       rating: r.rating,
//       comment: r.snippet || '',
//       reviewDate: new Date(r.iso_date),
//     }));

//     return {
//       name: data.place_info?.title || 'Unknown',
//       overallRating: data.place_info?.rating || 0,
//       totalReviews: data.place_info?.reviews || 0,
//       reviews,
//     };
//   } catch (error) {
//     logger.error('SerpApi fetch error:', error.message);
//     throw error;
//   }
// };


const fetchPlaceReviews = async (placeId) => {
  try {
    console.log('Fetching reviews for place:', placeId);

    let allReviews = [];
    let nextPageToken = null;
    let placeInfo = null;
    let pageCount = 0;
    const MAX_PAGES = 4; // fetch max 3 pages = ~24 reviews

    do {
      const url = nextPageToken
        ? `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&sort=newestFirst&next_page_token=${nextPageToken}&api_key=${process.env.SERPAPI_KEY}`
        : `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&sort=newestFirst&api_key=${process.env.SERPAPI_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(`SerpApi error: ${data.error || 'Unknown error'}`);
      }

      // Save place info from first page
      if (!placeInfo) {
        placeInfo = data.place_info;
      }

      const pageReviews = (data.reviews || []).map((r) => ({
        googleReviewId: `${placeId}_${r.iso_date}`,
        reviewerName: r.user?.name || 'Anonymous',
        reviewerPhoto: r.user?.thumbnail || null,
        rating: r.rating,
        comment: r.snippet || '',
        reviewDate: new Date(r.iso_date),
      }));

      allReviews = [...allReviews, ...pageReviews];
      pageCount++;

      console.log(`Page ${pageCount}: fetched ${pageReviews.length} reviews`);

      // Check if there is next page
      nextPageToken = data.serpapi_pagination?.next_page_token || null;

    } while (nextPageToken && pageCount < MAX_PAGES);

    console.log(`Total reviews fetched: ${allReviews.length}`);

    return {
      name: placeInfo?.title || 'Unknown',
      overallRating: placeInfo?.rating || 0,
      totalReviews: placeInfo?.reviews || 0,
      reviews: allReviews,
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