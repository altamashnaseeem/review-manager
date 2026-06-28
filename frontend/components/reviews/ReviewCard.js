'use client';
import { useState } from 'react';
import { RefreshCw, Send, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { useReview } from '../../context/ReviewContext';

export default function ReviewCard({ review }) {
  const [reply, setReply] = useState(review.aiSuggestedReply || '');
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { postReply, regenerateReply, dismissReview, posting } = useReview();

  const isBad = review.rating <= 3;
  const statusColors = {
    pending:   'badge-yellow',
    approved:  'badge-blue',
    posted:    'badge-green',
    dismissed: 'badge-gray',
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    const result = await regenerateReply(review._id);
    if (result.success) setReply(result.reply);
    setRegenerating(false);
  };

  const handlePost = async () => {
    if (!reply.trim()) return;
    await postReply(review._id, reply);
  };

  const handleDismiss = async () => {
    await dismissReview(review._id);
  };

  return (
    <div className={`card p-5 transition-all ${isBad && review.replyStatus === 'pending' ? 'border-red-100 bg-red-50/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-gray-600 text-sm">
            {review.reviewerName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{review.reviewerName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} />
              <span className="text-xs text-gray-400">
                {new Date(review.reviewDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <span className={statusColors[review.replyStatus]}>{review.replyStatus}</span>
      </div>

      {/* Review text */}
      {review.comment && (
        <p className="text-sm text-gray-700 mb-4 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5">
          "{review.comment}"
        </p>
      )}

      {/* AI Reply section — only for bad reviews that are pending */}
      {isBad && review.replyStatus === 'pending' && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🤖 AI suggested reply</span>
            <button onClick={handleRegenerate} disabled={regenerating} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50">
              <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
              {regenerating ? 'Generating...' : 'Regenerate'}
            </button>
          </div>

          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            className="input-field resize-none text-sm leading-relaxed mb-3"
            placeholder="AI reply will appear here..."
          />

          <div className="flex gap-2">
            <button onClick={handleDismiss} className="btn-secondary text-sm px-3 py-2">
              <X size={14} /> Dismiss
            </button>
            <button onClick={handlePost} disabled={posting || !reply.trim()} className="btn-primary flex-1 justify-center text-sm py-2">
              {posting ? <><Loader2 size={14} className="animate-spin" /> Posting to Google...</> : <><Send size={14} /> Post Reply to Google</>}
            </button>
          </div>
        </div>
      )}

      {/* Show posted reply */}
      {review.replyStatus === 'posted' && review.finalReply && (
        <div className="border-t border-gray-100 pt-3">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide reply' : 'View posted reply'}
          </button>
          {expanded && (
            <p className="mt-2 text-sm text-gray-600 bg-green-50 rounded-lg px-3 py-2.5 leading-relaxed">
              {review.finalReply}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
