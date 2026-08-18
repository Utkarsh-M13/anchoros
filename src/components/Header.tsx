import anchorIcon from "../assets/anchor.png";

export function Header() {
  return (
    <header className="header">
      <img className="anchor-badge" src={anchorIcon} alt="" />
      <h1>AnchorOS</h1>
      <span className="tagline">{"-  “Fall to your systems”"}</span>
    </header>
  );
}
