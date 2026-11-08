// Synthetic Google-shaped data; never calls Google or represents a real business.
export function demoReviewPage(businessId, pageToken) {
  const offset = Number(pageToken || 0);
  const reviews = Array.from({ length: 125 }, (_, i) => ({
    reviewId: `demo-${businessId}-${i + 1}`,
    reviewer: { displayName: `Demo customer ${i + 1}` },
    starRating: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][i % 5],
    comment: `Synthetic review ${i + 1} for development testing.`,
    createTime: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    updateTime: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    ...(i === 4 ? { reviewReply: { comment: 'Synthetic owner reply.', updateTime: '2026-01-02T00:00:00Z' } } : {}),
  }));
  return {
    reviews: reviews.slice(offset, offset + 50), averageRating: 3, totalReviewCount: reviews.length,
    ...(offset + 50 < reviews.length ? { nextPageToken: String(offset + 50) } : {}),
  };
}
