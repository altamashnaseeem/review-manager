import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import { BusinessProvider } from '../context/BusinessContext';
import { ReviewProvider } from '../context/ReviewContext';
import { ThemeProvider } from '../context/ThemeContext';
import { themeBootstrap } from '../lib/theme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'RepliQ — Protect Your Business Reputation',
  description: 'Monitor Google reviews, receive WhatsApp alerts, and approve thoughtful AI-assisted replies.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
        <AuthProvider>
          <BusinessProvider>
            <ReviewProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: { background: 'rgb(var(--raised))', color: 'rgb(var(--ink))', border: '1px solid rgb(var(--line))', fontSize: '14px', borderRadius: '10px' },
                  success: { iconTheme: { primary: 'rgb(var(--success))', secondary: 'rgb(var(--surface))' } },
                  error: { iconTheme: { primary: 'rgb(var(--danger))', secondary: 'rgb(var(--surface))' } },
                }}
              />
            </ReviewProvider>
          </BusinessProvider>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
