import api from './axios';
let sdk;
async function loadRazorpay() {
  if (typeof window.Razorpay === 'function') return;
  if (!sdk) sdk = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    const failed = () => { sdk = null; script.remove(); reject(new Error('Could not load checkout. Please try again.')); };
    script.onload = () => typeof window.Razorpay === 'function' ? resolve() : failed();
    script.onerror = failed;
    document.body.appendChild(script);
  });
  await sdk;
}
export async function openCheckout(plan, expectedPlanId) {
  const { data } = await api.post('/checkout/session', { plan, expectedPlanId });
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    let verifying = false, settled = false, failedAttempt = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(result);
    };
    const checkout = new window.Razorpay({
      key: data.razorpayKeyId, subscription_id: data.subscriptionId, name: 'RepliQ', description: `${plan} subscription`,
      prefill: { name: data.name, email: data.email, contact: data.phone }, theme: { color: '#2563eb' },
      modal: { ondismiss: () => {
        if (!verifying) finish(new Error(failedAttempt ? 'Payment did not complete. Check its status before retrying.' : 'Checkout was closed.'));
      } },
      handler: async response => {
        if (verifying || settled) return;
        verifying = true;
        try { const verified = await api.post('/checkout/verify', response); finish(null, verified.data); }
        catch (error) { finish(new Error(error.response?.data?.message || 'Payment could not be verified. Refresh subscription status before trying another payment.')); }
        finally { verifying = false; }
      },
    });
    // Razorpay keeps the modal open for retries. A failed attempt is not terminal.
    checkout.on('payment.failed', () => { failedAttempt = true; });
    checkout.open();
  });
}
export async function refreshSubscriptionStatus() {
  const { data } = await api.post('/checkout/status');
  return data;
}
