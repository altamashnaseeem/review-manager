'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Send, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { useBusiness } from '../../context/BusinessContext';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { useReview } from '../../context/ReviewContext';

export default function ReviewCard({ review }) {
  const [reply, setReply] = useState(review.finalReply || review.aiSuggestedReply || '');
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { postReply, regenerateReply, dismissReview, posting } = useReview();

  const { selectedBusiness } = useBusiness();
  const [retryingAlert, setRetryingAlert] = useState(false);
  const [alertState, setAlertState] = useState(review);
  useEffect(() => { setReply(review.finalReply || review.aiSuggestedReply || ''); setAlertState(review); }, [review]);
  const retryAlert = async () => {
    setRetryingAlert(true);
    try {
      const { data } = await api.post(`/reviews/${review._id}/retry-alert`);
      setAlertState(data.review);
      toast.success(data.review.alertStatus === 'accepted' ? 'WhatsApp alert accepted by Twilio' : 'Alert retry processed');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not retry alert'); }
    finally { setRetryingAlert(false); }
  };
  const isDemo = review.source === 'demo';
  const isBad = review.rating <= (selectedBusiness?.alertOnRating ?? 3);
  const statusColors = {
    pending:   'badge-yellow',
    approved:  'badge-blue',
    posted:    'badge-green',
    posting:   'badge-blue',
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

      {alertState.alertStatus === 'simulated' && <p className="text-xs text-amber-800 mb-3">{alertState.alertPreview}</p>}
      {alertState.alertStatus === 'accepted' && <p className="text-xs text-green-700 mb-3">WhatsApp alert accepted by Twilio. Delivery can be checked in Twilio message logs.</p>}
      {alertState.alertStatus === 'failed' && <div className="text-xs text-red-700 mb-3">
        <p>{alertState.alertError} Attempt {alertState.alertAttemptCount} of 5.</p>
        <button className="underline mt-1" disabled={retryingAlert} onClick={retryAlert}>{retryingAlert ? 'Retrying…' : 'Retry WhatsApp alert'}</button>
      </div>}
      {review.aiReplyError && <p className="text-xs text-amber-800 mb-3">{review.aiReplyError}</p>}
      {review.replyError && <p role="alert" className="text-xs text-red-700 mb-3">{review.replyError}</p>}
      {review.replyStatus === 'posting' && <p className="text-sm text-blue-700">Posting your approved reply. Refresh to check the result.</p>}
      {/* AI drafts are posted only after the owner approves the text. */}
      {(isBad || review.replyStatus === 'approved') && ['pending', 'approved'].includes(review.replyStatus) && (
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
            aria-label="Reply to this review"
            placeholder="Generate an AI draft or write your reply here..."
          />

          <p className="text-xs text-gray-500 mb-3">Edit the draft if needed. Approving posts this exact text to Google on your behalf.</p>
          <div className="flex gap-2">
            <button onClick={handleDismiss} className="btn-secondary text-sm px-3 py-2">
              <X size={14} /> Dismiss
            </button>
            <button onClick={handlePost} disabled={posting || !reply.trim()} className="btn-primary flex-1 justify-center text-sm py-2">
              {posting ? <><Loader2 size={14} className="animate-spin" /> {isDemo ? 'Saving demo reply...' : 'Posting to Google...'}</> : <><Send size={14} /> {isDemo ? 'Save demo reply locally' : 'Approve & post to Google'}</>}
            </button>
          </div>
        </div>
      )}

      {/* Show posted reply */}
      {review.replyStatus === 'posted' && review.finalReply && (
        <div className="border-t border-gray-100 pt-3">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide reply' : isDemo ? 'View local demo reply' : 'View posted reply'}
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
