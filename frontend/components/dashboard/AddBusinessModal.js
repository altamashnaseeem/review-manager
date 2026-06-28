'use client';
import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useBusiness } from '../../context/BusinessContext';

export default function AddBusinessModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', googlePlaceId: '', alertPhone: '', alertEmail: '', alertOnRating: 3 });
  const [loading, setLoading] = useState(false);
  const { addBusiness } = useBusiness();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await addBusiness(form);
    if (result.success) {
      onClose();
      setForm({ name: '', googlePlaceId: '', alertPhone: '', alertEmail: '', alertOnRating: 3 });
    }
    setLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add your business" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Business name</label>
          <input
            type="text" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-field" placeholder="e.g. Sharma Restaurant"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Google Place ID</label>
          <input
            type="text" required value={form.googlePlaceId}
            onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })}
            className="input-field" placeholder="ChIJ..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Find it at{' '}
            <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
              Google Place ID Finder
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp alert number</label>
          <input
            type="tel" required value={form.alertPhone}
            onChange={(e) => setForm({ ...form, alertPhone: e.target.value })}
            className="input-field" placeholder="+91 9876543210"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Alert email (optional)</label>
          <input
            type="email" value={form.alertEmail}
            onChange={(e) => setForm({ ...form, alertEmail: e.target.value })}
            className="input-field" placeholder="owner@restaurant.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Alert me when rating is {form.alertOnRating} stars or below
          </label>
          <input
            type="range" min="1" max="5" value={form.alertOnRating}
            onChange={(e) => setForm({ ...form, alertOnRating: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 ⭐</span><span>2 ⭐⭐</span><span>3 ⭐⭐⭐</span><span>4 ⭐⭐⭐⭐</span><span>5 ⭐⭐⭐⭐⭐</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : <><Building2 size={14} /> Add Business</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}
