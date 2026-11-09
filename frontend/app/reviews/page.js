'use client';
import { useEffect, useState, useCallback } from 'react';
import { Star, Filter, Search, Building2, Plus } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import DemoReviewForm from '../../components/reviews/DemoReviewForm';
import ReviewCard from '../../components/reviews/ReviewCard';
import AddBusinessModal from '../../components/dashboard/AddBusinessModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useBusiness } from '../../context/BusinessContext';
import { useReview } from '../../context/ReviewContext';

const FILTERS = [
  { label: 'All Reviews', value: '' },
  { label: 'Needs reply', value: 'pending' },
  { label: 'Posted', value: 'posted' },
  { label: 'Dismissed', value: 'dismissed' },
];

const RATINGS = [
  { label: 'All Ratings', value: '' },
  { label: '1 ★', value: '1' },
  { label: '2 ★★', value: '2' },
  { label: '3 ★★★', value: '3' },
  { label: '4 ★★★★', value: '4' },
  { label: '5 ★★★★★', value: '5' },
];

export default function ReviewsPage() {
  const { selectedBusiness, businesses, loaded, selectBusiness } = useBusiness();
  const { reviews, loading, total, pages, fetchReviews } = useReview();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [showAddBusiness, setShowAddBusiness] = useState(false);

  const [linkedReview, setLinkedReview] = useState(null);
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('business') && query.get('review')) setLinkedReview({ businessId: query.get('business'), reviewId: query.get('review') });
  }, []);
  useEffect(() => {
    if (!linkedReview || !loaded) return;
    const target = businesses.find(b => b._id === linkedReview.businessId);
    if (!target) { setLinkError('This review link does not belong to one of your businesses.'); return; }
    if (target._id !== selectedBusiness?._id) selectBusiness(target);
  }, [linkedReview, loaded, businesses, selectedBusiness?._id, selectBusiness]);
  const clearLink = () => {
    setLinkedReview(null); setLinkError(''); setPage(1);
    window.history.replaceState({}, '', '/reviews');
  };

  useEffect(() => { setPage(1); }, [selectedBusiness?._id]);

  const loadReviews = useCallback(() => {
    if (!selectedBusiness?._id) return;
    
    const filters = { page };
    if (linkedReview) filters.reviewId = linkedReview.reviewId;
    if (statusFilter) filters.status = statusFilter;
    if (ratingFilter) filters.rating = ratingFilter;

    fetchReviews(selectedBusiness._id, filters);
  }, [selectedBusiness, page, linkedReview, statusFilter, ratingFilter, fetchReviews]);

  // This runs whenever business or filters change
  useEffect(() => {
    if (selectedBusiness?.googleConnected && selectedBusiness?.reviewsSynced) {
      if (!linkedReview || linkedReview.businessId === selectedBusiness._id) loadReviews();
    }
  }, [selectedBusiness, linkedReview, loadReviews]);

  const handleStatusFilter = (value) => {
    clearLink();
    setPage(1);
    setRatingFilter(''); // reset rating when changing status
    setStatusFilter(value);
  };

  const handleRatingFilter = (e) => {
    clearLink();
    setPage(1);
    setStatusFilter(''); // reset status when filtering by rating
    setRatingFilter(e.target.value);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reviews</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {selectedBusiness
                ? `${total} reviews for ${selectedBusiness.name}`
                : 'Select a business first'}
            </p>
          </div>
        </div>

        {linkError && <p role="alert" className="text-red-700 mb-4">{linkError}</p>}
        {linkedReview && <div className="mb-4 text-sm text-gray-600">Review opened from your alert. <button className="text-blue-600 underline" onClick={clearLink}>Show all reviews</button></div>}
        <DemoReviewForm onCreated={() => { clearLink(); setStatusFilter(''); setRatingFilter(''); }} />
        {/* No business */}
        {businesses.length === 0 && (
          <div className="card">
            <EmptyState
              icon={Building2}
              title="No business added yet"
              description="Add your business first to see and manage your Google reviews."
              action={
                <button onClick={() => setShowAddBusiness(true)} className="btn-primary">
                  <Plus size={16} /> Add Business
                </button>
              }
            />
          </div>
        )}

        {selectedBusiness && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              {/* Status filter buttons */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => handleStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      statusFilter === f.value
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f.value === 'pending' ? `Needs reply (≤${selectedBusiness.alertOnRating}★)` : f.label}
                  </button>
                ))}
              </div>

              {/* Rating dropdown */}
              <select
                value={ratingFilter}
                onChange={handleRatingFilter}
                className="input-field w-auto text-sm"
              >
                {RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Active filter indicator */}
            {(statusFilter || ratingFilter) && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-gray-500">Active filter:</span>
                {statusFilter && (
                  <span className="badge-blue text-xs">
                    {FILTERS.find(f => f.value === statusFilter)?.label}
                  </span>
                )}
                {ratingFilter && (
                  <span className="badge-blue text-xs">
                    {ratingFilter} Star
                  </span>
                )}
                <button
                  onClick={() => { setPage(1); setStatusFilter(''); setRatingFilter(''); }}
                  className="text-xs text-red-500 hover:underline ml-1"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Reviews list */}
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Star}
                  title="No reviews found"
                  description={
                    statusFilter || ratingFilter
                      ? "No reviews match the selected filters."
                      : "No reviews yet. Click Sync Reviews on dashboard."
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCard key={review._id} review={review} />
                ))}
              </div>
            )}
            {pages > 1 && <nav aria-label="Review pagination" className="mt-6 flex items-center justify-between">
              <button className="btn-secondary" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Previous page</button>
              <span className="text-sm text-gray-500">Page {page} of {pages}</span>
              <button className="btn-secondary" disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)}>Next page</button>
            </nav>}
          </>
        )}
      </div>

      <AddBusinessModal
        isOpen={showAddBusiness}
        onClose={() => setShowAddBusiness(false)}
      />
    </AppLayout>
  );
}