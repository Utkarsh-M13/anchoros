import { invoke } from "@tauri-apps/api/core";

// Locked = pinned to the desktop behind all apps (not movable).
// Unlocked = normal movable window. Position is remembered across restarts.
export const setLock = (locked: boolean) => invoke<void>("set_lock", { locked });
export const getLock = () => invoke<boolean>("get_lock");
