import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { hasApiKey, saveApiKey } from "../settings";

export function Settings({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    hasApiKey().then(setKeySet).catch(() => {});
    isEnabled().then(setAutostart).catch(() => {});
  }, []);

  const save = async () => {
    const k = key.trim();
    if (!k) return;
    await saveApiKey(k);
    setKey("");
    setSaved(true);
    setKeySet(true);
  };

  const toggleAutostart = async () => {
    try {
      if (autostart) {
        await disable();
        setAutostart(false);
      } else {
        await enable();
        setAutostart(true);
      }
    } catch {
      /* autostart only works on the built app; ignore in dev */
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            {"×"}
          </button>
        </div>

        <label className="settings-label">
          Anthropic API key {keySet && <span className="key-set">set</span>}
        </label>
        <input
          className="settings-input"
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button className="settings-save" onClick={save} disabled={!key.trim()}>
          Save to Keychain
        </button>
        {saved && <p className="settings-note">Saved to your macOS Keychain.</p>}

        <label className="settings-toggle">
          <input type="checkbox" checked={autostart} onChange={toggleAutostart} />
          Launch AnchorOS at login
        </label>

        <p className="settings-hint">
          The key is stored in Keychain, never in the app. Launch-at-login takes effect on the
          built app (npm run tauri build).
        </p>
      </div>
    </div>
  );
}
