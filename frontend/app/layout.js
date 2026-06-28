import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import { BusinessProvider } from '../context/BusinessContext';
import { ReviewProvider } from '../context/ReviewContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ReviewManager — Protect Your Business Reputation',
  description: 'Monitor Google reviews, get instant alerts, and reply with AI-generated responses.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <BusinessProvider>
            <ReviewProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: { background: '#1e293b', color: '#f8fafc', fontSize: '14px', borderRadius: '10px' },
                  success: { iconTheme: { primary: '#22c55e', secondary: '#f8fafc' } },
                  error: { iconTheme: { primary: '#f43f5e', secondary: '#f8fafc' } },
                }}
              />
            </ReviewProvider>
          </BusinessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
