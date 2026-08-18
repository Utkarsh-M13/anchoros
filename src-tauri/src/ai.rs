use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

// The API key lives in the macOS Keychain (set once via the app's Settings),
// so it survives restarts and is available when the app launches at login.
// An exported ANTHROPIC_API_KEY still wins if present (handy for dev).
const KEYCHAIN_SERVICE: &str = "com.anchoros.app";
const KEYCHAIN_ACCOUNT: &str = "anthropic_api_key";

fn get_api_key() -> Result<String, String> {
    if let Ok(k) = std::env::var("ANTHROPIC_API_KEY") {
        if !k.is_empty() {
            return Ok(k);
        }
    }
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .and_then(|e| e.get_password())
        .map_err(|_| {
            "No Anthropic API key set. Add it in AnchorOS settings (the gear).".to_string()
        })
}

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    let entry =
        keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_api_key() -> bool {
    if std::env::var("ANTHROPIC_API_KEY")
        .map(|k| !k.is_empty())
        .unwrap_or(false)
    {
        return true;
    }
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .and_then(|e| e.get_password())
        .map(|k| !k.is_empty())
        .unwrap_or(false)
}

// Haiku is fast, cheap, and plenty for this small structured task.
// To use a 5-series model instead (claude-opus-5 / claude-sonnet-5), also add
//   "thinking": {"type": "disabled"}
// to the body below and raise max_tokens, since those models think by default.
const MODEL: &str = "claude-haiku-4-5";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorCtx {
    anchor_type: String,
    status: String,
    intensity: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalCtx {
    title: String,
    priority: String,
    status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplanContext {
    date: String,
    message: String,
    anchors: Vec<AnchorCtx>,
    goals: Vec<GoalCtx>,
    weekly_scores: HashMap<String, f64>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedChange {
    action: String,
    goal_title: String,
    #[serde(default)]
    new_title: Option<String>,
    #[serde(default)]
    priority: Option<String>,
    reason: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplanResult {
    overview: String,
    minimum_viable_day: String,
    proposed_changes: Vec<ProposedChange>,
}

// Called from the React side via `invoke("ai_replan", { context })`.
// The API key stays in this process (read from the environment); it never
// reaches the webview bundle.
#[tauri::command]
pub async fn ai_replan(context: ReplanContext) -> Result<ReplanResult, String> {
    let api_key = get_api_key()?;

    let anchors: String = context
        .anchors
        .iter()
        .map(|a| format!("- {}: {} (intensity {})", a.anchor_type, a.status, a.intensity))
        .collect::<Vec<_>>()
        .join("\n");
    let goals: String = context
        .goals
        .iter()
        .map(|g| format!("- [{}] {} ({})", g.priority, g.title, g.status))
        .collect::<Vec<_>>()
        .join("\n");
    let scores: String = context
        .weekly_scores
        .iter()
        .map(|(k, v)| format!("{}: {:.0}", k, v))
        .collect::<Vec<_>>()
        .join(", ");

    let user_content = format!(
        "Date: {}\n\nWhat changed today (from me):\n{}\n\nToday's anchors:\n{}\n\nToday's goals:\n{}\n\nWeekly anchor scores (0-100): {}",
        context.date, context.message, anchors, goals, scores
    );

    let system = "You are the planning layer of AnchorOS, a personal system built on 'drift, notice, return'. The goal is a realistic day that stays alive, not a perfect day. Make the SMALLEST set of changes that directly answers what the user said, and nothing more. If they ask to remove, drop, or cut a goal, use action 'drop' on exactly that goal (matched by its exact current title) and do not add or rearrange any other goals. Only use 'add' when the user's message clearly calls for a brand-new goal; never re-add or duplicate an existing one. Also return a one-line overview and a minimum viable day (the smallest set that keeps today alive). Reference existing goals by their exact current title in goalTitle. Plain, direct language, no em dashes.";

    let schema = json!({
        "type": "object",
        "properties": {
            "overview": {"type": "string"},
            "minimumViableDay": {"type": "string"},
            "proposedChanges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {"type": "string", "enum": ["add", "modify", "drop"]},
                        "goalTitle": {"type": "string"},
                        "newTitle": {"type": "string"},
                        "priority": {"type": "string", "enum": ["primary", "secondary", "optional"]},
                        "reason": {"type": "string"}
                    },
                    "required": ["action", "goalTitle", "reason"],
                    "additionalProperties": false
                }
            }
        },
        "required": ["overview", "minimumViableDay", "proposedChanges"],
        "additionalProperties": false
    });

    let body = json!({
        "model": MODEL,
        "max_tokens": 1024,
        "output_config": {"format": {"type": "json_schema", "schema": schema}},
        "system": system,
        "messages": [{"role": "user", "content": user_content}]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status();
    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("bad response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Anthropic API error ({}): {}", status, val));
    }
    if val["stop_reason"] == "refusal" {
        return Err("The request was declined by safety filters.".to_string());
    }

    let text = val["content"][0]["text"]
        .as_str()
        .ok_or_else(|| format!("unexpected response shape: {}", val))?;
    let result: ReplanResult = serde_json::from_str(text)
        .map_err(|e| format!("could not parse AI output: {} (raw: {})", e, text))?;
    Ok(result)
}
