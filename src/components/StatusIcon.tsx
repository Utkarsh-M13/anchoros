import { AnchorStatus } from "../types";

// Clean, symmetric status icons drawn on a shared 20x20 grid with a uniform
// 2px round stroke, so they read as one consistent set. Color is inherited
// (currentColor) so they sit as a dark silhouette on the filled white cell.
export function StatusIcon({ status, size = 15 }: { status: AnchorStatus; size?: number }) {
  const common = {
    viewBox: "0 0 20 20",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (status) {
    case "complete":
      return (
        <svg {...common}>
          <path d="M4.5 10.5 L8.5 14.5 L15.5 6" />
        </svg>
      );
    case "partial":
      return (
        <svg {...common}>
          <line x1="5" y1="10" x2="15" y2="10" />
        </svg>
      );
    case "intentional_skip":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6" />
          <line x1="5.75" y1="14.25" x2="14.25" y2="5.75" />
        </svg>
      );
    case "drifted":
      return (
        <svg {...common}>
          <line x1="6" y1="6" x2="14" y2="14" />
          <line x1="14" y1="6" x2="6" y2="14" />
        </svg>
      );
    default:
      return null;
  }
}
