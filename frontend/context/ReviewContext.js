'use client';
import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useBusiness } from './BusinessContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const initialState = {
  reviews: [],
  stats: null,
  loading: false,
  posting: false,
  total: 0,
  page: 1,
  pages: 1,
};

const reviewReducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return { ...initialState };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_POSTING':
      return { ...state, posting: action.payload };
    case 'SET_REVIEWS':
      return { ...state, reviews: action.payload.reviews, total: action.payload.total, page: action.payload.page, pages: action.payload.pages, loading: false };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'UPDATE_REVIEW':
      return { ...state, reviews: state.reviews.map(r => r._id === action.payload._id ? action.payload : r), posting: false };
    case 'UPDATE_AI_REPLY':
      return { ...state, reviews: state.reviews.map(r => r._id === action.payload.id ? { ...r, aiSuggestedReply: action.payload.reply } : r) };
    default:
      return state;
  }
};

const ReviewContext = createContext(null);

export const ReviewProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reviewReducer, initialState);

  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();
  const selection = `${user?.id || ''}/${selectedBusiness?._id || ''}`;
  const activeSelection = useRef(selection);
  activeSelection.current = selection;
  useEffect(() => { dispatch({ type: 'RESET' }); }, [selection]);

  const fetchReviews = useCallback(async (businessId, filters = {}) => {
    if (!businessId) return;
    const requestedSelection = activeSelection.current;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const params = new URLSearchParams(filters).toString();
      const { data } = await api.get(`/reviews/${businessId}?${params}`);
      if (activeSelection.current === requestedSelection) dispatch({ type: 'SET_REVIEWS', payload: data });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      toast.error('Failed to load reviews');
    }
  }, []);

  const fetchStats = useCallback(async (businessId) => {
    if (!businessId) return;
    const requestedSelection = activeSelection.current;
    try {
      const { data } = await api.get(`/reviews/${businessId}/stats`);
      if (activeSelection.current === requestedSelection) dispatch({ type: 'SET_STATS', payload: data.stats });
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  }, []);

  const postReply = async (reviewId, finalReply) => {
    dispatch({ type: 'SET_POSTING', payload: true });
    try {
      const { data } = await api.post(`/reviews/${reviewId}/post-reply`, { finalReply });
      dispatch({ type: 'UPDATE_REVIEW', payload: data.review });
      toast.success(data.message);
      return { success: true };
    } catch (error) {
      dispatch({ type: 'SET_POSTING', payload: false });
      toast.error(error.response?.data?.message || 'Failed to post reply');
      return { success: false };
    }
  };

  const regenerateReply = async (reviewId) => {
    try {
      const { data } = await api.post(`/reviews/${reviewId}/regenerate`);
      dispatch({ type: 'UPDATE_AI_REPLY', payload: { id: reviewId, reply: data.aiSuggestedReply } });
      toast.success('New AI reply generated!');
      return { success: true, reply: data.aiSuggestedReply };
    } catch (error) {
      toast.error('Failed to regenerate reply');
      return { success: false };
    }
  };

  const dismissReview = async (reviewId) => {
    try {
      const { data } = await api.put(`/reviews/${reviewId}/dismiss`);
      dispatch({ type: 'UPDATE_REVIEW', payload: data.review });
      toast.success('Review dismissed');
      return { success: true };
    } catch (error) {
      toast.error('Failed to dismiss review');
      return { success: false };
    }
  };

  return (
    <ReviewContext.Provider value={{ ...state, fetchReviews, fetchStats, postReply, regenerateReply, dismissReview }}>
      {children}
    </ReviewContext.Provider>
  );
};

export const useReview = () => {
  const context = useContext(ReviewContext);
  if (!context) throw new Error('useReview must be used inside ReviewProvider');
  return context;
};
