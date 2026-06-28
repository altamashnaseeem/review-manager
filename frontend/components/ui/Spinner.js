export default function Spinner({ size = 'md', color = 'blue' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  const colors = { blue: 'border-blue-600', white: 'border-white', gray: 'border-gray-400' };
  return (
    <div className={`${sizes[size]} border-4 ${colors[color]} border-t-transparent rounded-full animate-spin`} />
  );
}
