// Create or update the Skybird website chat agent in HighLevel Conversation AI.
//
//   node scripts/ghl-agent.mjs show      read the agent and its actions
//   node scripts/ghl-agent.mjs push      create it (first run) or update it
//
// Reads docs/ghl-bot/prompt.md (personality / goal / instructions) and
// docs/ghl-bot/agent.config.json (settings + actions). The agent id is kept in
// docs/ghl-bot/agent-id.txt after the first create.
//
// Auth: the environment's API credential adds "Authorization: Bearer ..." to
// requests for services.leadconnectorhq.com; no token lives in this repo.
// "mode" and "channels" come only from the config file, so a push never puts
// the bot in front of customers unless that file says so.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = "https://services.leadconnectorhq.com/conversation-ai";
const DIR = new URL("../docs/ghl-bot/", import.meta.url);
const ID_FILE = new URL("agent-id.txt", DIR);

// curl, not fetch: the credential is injected by the HTTPS proxy, which curl
// honours from the environment.
function api(method, path, body) {
  const args = ["-sS", "-m", "60", "-X", method, "-w", "\n%{http_code}",
    "-H", "Version: 2021-04-15", "-H", "Accept: application/json"];
  if (body) args.push("-H", "Content-Type: application/json", "--data-binary", JSON.stringify(body));
  const out = execFileSync("curl", [...args, BASE + path], { encoding: "utf8" });
  const i = out.lastIndexOf("\n");
  const status = Number(out.slice(i + 1));
  const text = out.slice(0, i);
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (status >= 300) throw new Error(`${method} ${path} -> ${status}: ${text}`);
  return json;
}

function prompt() {
  const md = readFileSync(new URL("prompt.md", DIR), "utf8");
  const section = (name) => {
    const m = md.match(new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m"));
    if (!m) throw new Error(`prompt.md has no "## ${name}" section`);
    return m[1].trim();
  };
  return { personality: section("personality"), goal: section("goal"), instructions: section("instructions") };
}

const config = JSON.parse(readFileSync(new URL("agent.config.json", DIR), "utf8"));
const agentId = existsSync(ID_FILE) ? readFileSync(ID_FILE, "utf8").trim() : null;
const cmd = process.argv[2];

if (cmd === "show") {
  if (!agentId) throw new Error("no agent-id.txt yet; run push first");
  console.log(JSON.stringify(api("GET", `/agents/${agentId}`), null, 2));
  console.log(JSON.stringify(api("GET", `/agents/${agentId}/actions/list`), null, 2));
} else if (cmd === "push") {
  const body = { ...config.agent, ...prompt() };
  let id = agentId;
  if (!id) {
    const res = api("POST", "/agents", body);
    id = res.id || res.agent?.id || res._id;
    if (!id) throw new Error("create returned no id: " + JSON.stringify(res));
    writeFileSync(ID_FILE, id + "\n");
    console.log("created agent", id);
  } else {
    api("PUT", `/agents/${id}`, body);
    console.log("updated agent", id);
  }
  // Actions are matched by name: update if present, attach if not.
  const listed = api("GET", `/agents/${id}/actions/list`);
  const existing = listed.actions || listed.data || [];
  for (const action of config.actions) {
    const found = existing.find((a) => a.name === action.name);
    if (found) {
      api("PUT", `/agents/${id}/actions/${found.id || found._id}`, action);
      console.log("updated action", action.name);
    } else {
      const res = api("POST", `/agents/${id}/actions`, action);
      console.log("attached action", action.name, res.id || res.action?.id || "");
    }
  }
} else {
  console.log("usage: node scripts/ghl-agent.mjs show|push");
  process.exit(1);
}
