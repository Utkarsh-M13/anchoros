import anchorIcon from "../assets/anchor.png";

// Pushpin icon: filled when pinned (locked to wallpaper), outline when movable.
function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function Header({
  onSettings,
  onToggleLock,
  locked,
}: {
  onSettings?: () => void;
  onToggleLock?: () => void;
  locked?: boolean;
}) {
  return (
    <header className="header">
      <img className="anchor-badge" src={anchorIcon} alt="" />
      <h1>AnchorOS</h1>
      <span className="tagline">{"-  “Fall to your systems”"}</span>
      {onToggleLock && (
        <button
          className={`pin-btn ${locked ? "pinned" : ""}`}
          onClick={onToggleLock}
          title={locked ? "Unpin to move" : "Pin behind apps"}
        >
          <PinIcon pinned={!!locked} />
        </button>
      )}
      {onSettings && (
        <button className="settings-gear" onClick={onSettings} title="Settings">
          {"⚙"}
        </button>
      )}
    </header>
  );
}
