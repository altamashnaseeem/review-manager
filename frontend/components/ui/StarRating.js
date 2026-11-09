export default function StarRating({ rating, size = 'sm' }) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
  return (
    <div role="img" aria-label={`${rating} out of 5 stars`} className={`flex items-center gap-0.5 ${sizes[size]}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden="true" className={star <= rating ? 'text-caution' : 'text-muted'}>★</span>
      ))}
    </div>
  );
}
