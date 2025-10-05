export default function AnimatedBackground() {
  return (
    <div className="frame">
      <div className="moon">
        <div className="moon-crater1"></div>
        <div className="moon-crater2"></div>
      </div>
      <div className="hill-bg-1"></div>
      <div className="hill-bg-2"></div>
      <div className="hill-fg-1"></div>
      <div className="hill-fg-2"></div>
      <div className="hill-fg-3"></div>

      {/* Raindrops */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i}>
          <div className={`drop-big-${i + 1}`}></div>
          <div className={`drop-medium-${i + 1}`}></div>
          <div className={`drop-small-${i + 1}`}></div>
        </div>
      ))}
    </div>
  );
}
