import Link from 'next/link';

export function BrandMark({ className = 'h-8 w-8' }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="3.5" y="3.5" width="25" height="25" rx="8" stroke="currentColor" />
    <path d="M16 7.5c1.3 5.1 3.4 7.2 8.5 8.5-5.1 1.3-7.2 3.4-8.5 8.5-1.3-5.1-3.4-7.2-8.5-8.5 5.1-1.3 7.2-3.4 8.5-8.5Z" fill="currentColor" />
  </svg>;
}
export default function Brand({ href = '/', className = '', onClick }) {
  return <Link href={href} onClick={onClick} className={`inline-flex shrink-0 items-center gap-2.5 text-ink ${className}`} aria-label="RepliQ home">
    <BrandMark /><span className="text-xl font-semibold tracking-[-0.05em]">RepliQ<span className="text-accent">.</span></span>
  </Link>;
}
