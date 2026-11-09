export default function ReputationOrbit({ className = '' }) {
  return <div className={`reputation-orbit ${className}`} aria-hidden="true">
    <div className="orbit-halo" />
    <div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><div className="orbit-ring orbit-ring-three" />
    <div className="orbit-core"><span>✦</span></div>
    <div className="orbit-satellite orbit-satellite-one" /><div className="orbit-satellite orbit-satellite-two" />
  </div>;
}
