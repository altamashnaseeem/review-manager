'use client';
import { useEffect, useState } from 'react';
import { Star, Filter, Search, Building2, Plus } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import ReviewCard from '../../components/reviews/ReviewCard';
import AddBusinessModal from '../../components/dashboard/AddBusinessModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useBusiness } from '../../context/BusinessContext';
import { useReview } from '../../context/ReviewContext';

const FILTERS = [
  { label: 'All Reviews', value: '' },
  { label: 'Pending Reply', value: 'pending' },
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
  const { selectedBusiness, businesses } = useBusiness();
  const { reviews, loading, total, fetchReviews } = useReview();
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [showAddBusiness, setShowAddBusiness] = useState(false);

  useEffect(() => {
    if (selectedBusiness?._id) {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (ratingFilter) filters.rating = ratingFilter;
      fetchReviews(selectedBusiness._id, filters);
    }
  }, [selectedBusiness, statusFilter, ratingFilter]);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reviews</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {selectedBusiness ? `${total} total reviews for ${selectedBusiness.name}` : 'Select a business first'}
            </p>
          </div>
        </div>

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

        {/* Filters */}
        {selectedBusiness && (
          <>
            <div className="flex flex-wrap gap-3 mb-5">
              {/* Status filter */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Rating filter */}
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="input-field w-auto text-sm"
              >
                {RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Reviews list */}
            {loading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : reviews.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Star}
                  title="No reviews found"
                  description="No reviews match the selected filters, or your reviews haven't been fetched yet."
                />
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCard key={review._id} review={review} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AddBusinessModal isOpen={showAddBusiness} onClose={() => setShowAddBusiness(false)} />
    </AppLayout>
  );
}
