'use client';
import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const initialState = {
  businesses: [],
  selectedBusiness: null,
  loading: false,
  error: null,
  loaded: false,
  demoEnabled: false,
  demoWhatsAppEnabled: false,
};

const businessReducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return { ...initialState };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_BUSINESSES':
      return { ...state, businesses: action.payload.businesses, loading: false, loaded: true, error: null,
        demoEnabled: action.payload.demoEnabled,
        demoWhatsAppEnabled: action.payload.demoWhatsAppEnabled === true,
        selectedBusiness: action.payload.businesses.find(b => b._id === state.selectedBusiness?._id)
          || action.payload.businesses.find(b => b.googleConnected && b.reviewsSynced) || action.payload.businesses[0] || null };
    case 'ADD_BUSINESS':
      return { ...state, businesses: [...state.businesses, action.payload], loading: false };
    case 'UPDATE_BUSINESS':
      return {
        ...state,
        businesses: state.businesses.map(b => b._id === action.payload._id ? action.payload : b),
        selectedBusiness: state.selectedBusiness?._id === action.payload._id ? action.payload : state.selectedBusiness,
        loading: false,
      };
    case 'DELETE_BUSINESS':
      return {
        ...state,
        businesses: state.businesses.filter(b => b._id !== action.payload),
        selectedBusiness: state.selectedBusiness?._id === action.payload ? null : state.selectedBusiness,
        loading: false,
      };
    case 'SELECT_BUSINESS':
      return { ...state, selectedBusiness: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false, loaded: true };
    default:
      return state;
  }
};

const BusinessContext = createContext(null);

export const BusinessProvider = ({ children }) => {
  const [state, dispatch] = useReducer(businessReducer, initialState);

  const { user } = useAuth();
  const ownerId = user?.id;
  const activeOwner = useRef(ownerId);
  activeOwner.current = ownerId;
  const fetchBusinesses = useCallback(async () => {
    if (!ownerId) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await api.get('/business');
      if (activeOwner.current === ownerId) dispatch({ type: 'SET_BUSINESSES', payload: data });
    } catch (error) {
      if (activeOwner.current === ownerId) dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Could not load your businesses. Please retry.' });
    }
  }, [ownerId]);
  useEffect(() => {
    dispatch({ type: 'RESET' });
    if (ownerId) fetchBusinesses();
  }, [ownerId, fetchBusinesses]);

  const addBusiness = async (businessData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await api.post('/business', businessData);
      dispatch({ type: 'ADD_BUSINESS', payload: data.business });
      dispatch({ type: 'SELECT_BUSINESS', payload: data.business });
      toast.success('Business added successfully!');
      return { success: true, business: data.business };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to add business';
      toast.error(msg);
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: false, message: msg };
    }
  };

  const updateBusiness = async (id, businessData) => {
    try {
      const { data } = await api.put(`/business/${id}`, businessData);
      dispatch({ type: 'UPDATE_BUSINESS', payload: data.business });
      toast.success('Business updated successfully!');
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update business';
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const deleteBusiness = async (id) => {
    try {
      await api.delete(`/business/${id}`);
      dispatch({ type: 'DELETE_BUSINESS', payload: id });
      toast.success('Business removed');
      return { success: true };
    } catch (error) {
      toast.error('Failed to remove business');
      return { success: false };
    }
  };

  const selectBusiness = (business) => {
    dispatch({ type: 'SELECT_BUSINESS', payload: business });
  };

  return (
    <BusinessContext.Provider value={{ ...state, fetchBusinesses, addBusiness, updateBusiness, deleteBusiness, selectBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used inside BusinessProvider');
  return context;
};
