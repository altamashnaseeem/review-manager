import api from './axios';
let sdk;
async function loadRazorpay() {
  if (window.Razorpay) return;
  if (!sdk) sdk = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => { sdk = null; script.remove(); reject(new Error('Could not load checkout. Please try again.')); };
    document.body.appendChild(script);
  });
  await sdk;
}
export async function openCheckout(plan) {
  const { data } = await api.post('/checkout/session', { plan });
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: data.razorpayKeyId, subscription_id: data.subscriptionId, name: 'RepliQ', description: `${plan} subscription`,
      prefill: { name: data.name, email: data.email, contact: data.phone }, theme: { color: '#2563eb' },
      modal: { ondismiss: () => reject(new Error('Checkout was closed.')) },
      handler: async response => {
        try { const verified = await api.post('/checkout/verify', response); resolve(verified.data); }
        catch (error) { reject(new Error(error.response?.data?.message || 'Payment could not be verified. Refresh subscription status before trying another payment.')); }
      },
    });
    checkout.on('payment.failed', () => reject(new Error('Payment did not complete. Please check its status before retrying.')));
    checkout.open();
  });
}

export async function refreshSubscriptionStatus() {
  const { data } = await api.post('/checkout/status');
  return data;
}
