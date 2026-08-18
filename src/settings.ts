import { invoke } from "@tauri-apps/api/core";

// Stores the key in the macOS Keychain via the Rust command; the key never
// touches the JS bundle beyond this one input.
export const saveApiKey = (key: string) => invoke<void>("save_api_key", { key });
export const hasApiKey = () => invoke<boolean>("has_api_key");
