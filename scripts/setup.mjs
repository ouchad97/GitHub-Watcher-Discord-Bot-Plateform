// GitHub Watcher setup assistant: creates and connects everything (Cloudflare, Discord, GitHub App).
//
//   npm run setup            first-time setup (safe to run again: finished steps are skipped)
//   npm run setup:password   change the dashboard password
//   npm run setup:time       change the time of the daily report
//   npm run deploy           upload worker.js again after an update
//
// You need: Node.js 22+, a Cloudflare account, a Discord server where you are admin, a GitHub account.
// Your settings stay on this computer in .setup.json and wrangler.local.jsonc (both in .gitignore).
// Secrets go straight to Cloudflare (encrypted). They are never written in a project file.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes, createSign } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = process.env.GW_HOME || ROOT; // where your own settings are kept
const STATE_FILE = join(HOME, '.setup.json');
const CONFIG = join(HOME, 'wrangler.local.jsonc');
const DISCORD = process.env.GW_DISCORD_API || 'https://discord.com/api/v10';
const GITHUB = process.env.GW_GITHUB_API || 'https://api.github.com';
const GITHUB_WEB = process.env.GW_GITHUB_WEB || 'https://github.com';
const GROQ = process.env.GW_GROQ_API || 'https://api.groq.com/openai/v1';
const WRANGLER = process.env.GW_WRANGLER || 'npx --yes wrangler';
const PAUSE = Number(process.env.GW_PAUSE_MS ?? 3000);
const WORKER_NAME = 'github-watcher';
const KV_NAME = 'github-watcher-db';
const REPORT_UTC = '17:15'; // default time of the daily report
const MAIN_CHANNEL = 'github-activity';
const FORUM_CHANNEL = 'github-students';
// Manage Channels (creates the 2 channels) + View Channels + Manage Webhooks (creates the 2 webhooks)
// + Manage Threads (names each student's thread)
const BOT_PERMISSIONS = 16 + 1024 + 536870912 + 17179869184;
const GH_EVENTS = ['create', 'delete', 'push', 'pull_request', 'pull_request_review', 'pull_request_review_comment', 'issues', 'issue_comment', 'commit_comment', 'release', 'repository', 'fork', 'workflow_run'];

const C = { bold: (s) => `\x1b[1m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` };
const step = (n, s) => console.log(`\n${C.bold(`[${n}] ${s}`)}`);
const ok = (s) => console.log(C.green('  ✔ ' + s));
const warn = (s) => console.log(C.yellow('  ! ' + s));
const fail = (s) => { console.log(C.red('\n✖ ' + s)); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomKey = (n) => randomBytes(n).toString('base64url');
const pad = (n) => String(n).padStart(2, '0');

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

// ------------------------------------------------------------------ input
// One reader for the whole run, so typed (or piped) lines are never lost between questions.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
const lines = [];
let waiting = null;
let closed = false;
let muted = false;
rl.on('line', (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else lines.push(l); });
rl.on('close', () => { closed = true; if (waiting) waiting(null); });
rl.on('SIGINT', () => { console.log('\nStopped. Run `npm run setup` again to continue.'); process.exit(130); });
rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); else if (/[\r\n]/.test(s)) rl.output.write('\n'); };

async function ask(q, { hidden = false } = {}) {
  if (closed) process.stdout.write(q); // piped answers: the reader closes once it has read them all
  else { rl.setPrompt(q); rl.prompt(); }
  muted = hidden;
  const line = lines.length ? lines.shift() : closed ? null : await new Promise((r) => (waiting = r));
  muted = false;
  if (!process.stdin.isTTY) process.stdout.write('\n');
  if (line === null) fail('The input ended before the setup finished.');
  return line.trim();
}
async function yes(q, def = true) {
  const a = (await ask(`  ${q} ${def ? '(Y/n)' : '(y/N)'} `)).toLowerCase();
  return a ? /^[yo]/.test(a) : def;
}
async function choose(items, label, q) {
  items.forEach((it, i) => console.log(`   ${i + 1}. ${label(it)}`));
  for (;;) {
    const n = Number(await ask(`  ${q} Type its number: `));
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1];
    warn(`Type a number from 1 to ${items.length}.`);
  }
}

// --------------------------------------------------------------- commands
/** Run a command. Returns { code, out } (out = stdout + stderr). */
function run(cmd, { capture = true, quiet = false, input } = {}) {
  if (!capture && !closed) rl.pause();
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: ROOT, shell: true, stdio: [input !== undefined ? 'pipe' : 'ignore', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'] });
    if (input !== undefined) child.stdin.end(input);
    let out = '';
    if (capture) {
      const show = (d) => { out += d; if (!quiet) process.stdout.write(C.dim(String(d))); };
      child.stdout.on('data', show);
      child.stderr.on('data', show);
    }
    child.on('close', (code) => { if (!capture && !closed) rl.resume(); resolve({ code: code ?? 1, out }); });
  });
}
const wrangler = (args, opts) => run(`${WRANGLER} ${args}`, opts);
const withConfig = `-c "${CONFIG}"`;

function openUrl(url) {
  console.log(C.dim('  ' + url));
  if (process.env.GW_NO_OPEN) return;
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  spawn(cmd, { shell: true, stdio: 'ignore', detached: true }).unref();
}

// The first JSON array in a command's output (wrangler may print a banner or warnings first)
function jsonArray(out) {
  const end = out.lastIndexOf(']') + 1;
  for (let i = out.indexOf('['); i >= 0 && i < end; i = out.indexOf('[', i + 1)) {
    try { const a = JSON.parse(out.slice(i, end)); if (Array.isArray(a)) return a; } catch { /* try the next [ */ }
  }
  return null;
}

async function api(base, method, path, { auth, body, form } = {}) {
  const headers = { 'User-Agent': 'github-watcher-setup' };
  if (auth) headers.Authorization = auth;
  if (base === GITHUB) headers.Accept = 'application/vnd.github+json';
  if (body) headers['Content-Type'] = 'application/json';
  if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : form ? new URLSearchParams(form) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
const discord = (token, method, path, body) => api(DISCORD, method, path, { auth: `Bot ${token}`, body });

// ---------------------------------------------------------------- Cloudflare
// The report time: you type your local time, Cloudflare needs UTC.
function localToUtc(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function utcToLocal(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function utcOffset() {
  const min = -new Date().getTimezoneOffset();
  return 'UTC' + (min === 0 ? '' : (min > 0 ? '+' : '-') + Math.floor(Math.abs(min) / 60) + (Math.abs(min) % 60 ? ':' + pad(Math.abs(min) % 60) : ''));
}

function writeConfig() {
  const [h, m] = state.reportUtc.split(':').map(Number);
  const cfg = {
    name: state.name,
    main: relative(HOME, join(ROOT, state.main)).replace(/\\/g, '/'),
    compatibility_date: '2025-09-01',
    workers_dev: true,
    no_bundle: true, // upload worker.js as it is: bundling adds __name() calls that break the dashboard page
    find_additional_modules: false, // only worker.js, never the other files of its folder
    keep_vars: true, // keeps the text variables you set in the Cloudflare dashboard (SKIP_DAYS…)
    kv_namespaces: [{ binding: 'DB', id: state.kvId }],
    ai: { binding: 'AI' },
    triggers: { crons: [`${m} ${h} * * *`] },
    vars: { REPORT_TIME_UTC: state.reportUtc },
  };
  writeFileSync(CONFIG, '// Made by `npm run setup` with your own settings. Never commit it.\n' + JSON.stringify(cfg, null, 2) + '\n');
}

/** Names of the secrets already in Cloudflare, or null if the Worker doesn't exist yet. */
async function secretNames() {
  const r = await wrangler(`secret list ${withConfig}`, { quiet: true });
  const a = r.code === 0 ? jsonArray(r.out) : null;
  return a ? new Set(a.map((s) => s.name)) : null;
}

// Sent through stdin: the values never touch the disk
async function putSecrets(values, have) {
  for (;;) {
    const r = await wrangler(`secret bulk ${withConfig}`, { quiet: true, input: JSON.stringify(values) });
    if (r.code === 0) break;
    console.log(C.dim(r.out));
    warn('Cloudflare did not save the secrets (see the message above).');
    await ask('  Press Enter to try again (Ctrl+C to stop)… ');
  }
  const saved = Object.keys(values).filter((k) => values[k] !== null); // null = delete that secret
  const removed = Object.keys(values).filter((k) => values[k] === null);
  for (const k of saved) have.add(k);
  for (const k of removed) have.delete(k);
  ok(`Saved in Cloudflare (encrypted): ${saved.join(', ')}${removed.length ? ` (removed: ${removed.join(', ')})` : ''}`);
}

async function deploy() {
  for (;;) {
    const r = await wrangler(`deploy ${withConfig}`);
    const m = r.out.match(new RegExp(`https://${state.name}\\.([a-z0-9-]+)\\.workers\\.dev`, 'i'));
    if (r.code === 0 && m) return `https://${state.name}.${m[1]}.workers.dev`.toLowerCase();
    if (/subdomain/i.test(r.out)) {
      warn('Your Cloudflare account needs a free workers.dev subdomain first.');
      openUrl('https://dash.cloudflare.com/?to=/:account/workers-and-pages');
      await ask('  In the page that opened, choose a subdomain (Workers & Pages asks for it), then press Enter… ');
      continue;
    }
    fail('Uploading the Worker failed. See the message above, then run `npm run setup` again.');
  }
}

// ---------------------------------------------------------------- Discord
// Uses the channel with that name, or creates it (type 0 = text channel, 15 = forum)
async function channelFor(token, guildId, name, type, invite) {
  for (;;) {
    const list = await discord(token, 'GET', `/guilds/${guildId}/channels`);
    const found = Array.isArray(list.data) ? list.data.find((c) => c.type === type && c.name === name) : null;
    if (found) return found;
    const topic = type === 15 ? 'One thread per student: their GitHub activity.' : 'GitHub activity: daily reports, alerts and deadlines.';
    const r = await discord(token, 'POST', `/guilds/${guildId}/channels`, { name, type, topic });
    if (r.ok) return r.data;
    if (r.status !== 403) return null; // e.g. forums not available in this server
    warn(`The bot can't create #${name}: it needs the Manage Channels permission.`);
    console.log('  Opening the invite page again: pick the same server and click Authorize (it updates the permissions).');
    openUrl(invite);
    await ask('  Press Enter to try again… ');
  }
}

// Reuses the bot's own webhook in that channel, so running the setup again creates nothing new
async function webhookFor(token, channel, name, invite) {
  for (;;) {
    const list = await discord(token, 'GET', `/channels/${channel.id}/webhooks`);
    let hook = list.ok && Array.isArray(list.data) ? list.data.find((w) => w.type === 1 && w.token && w.name === name) : null;
    if (!hook && list.ok) {
      const r = await discord(token, 'POST', `/channels/${channel.id}/webhooks`, { name });
      if (r.ok) hook = r.data;
    }
    if (hook) return hook.url || `https://discord.com/api/webhooks/${hook.id}/${hook.token}`;
    warn(`The bot can't create a webhook in #${channel.name}: it needs the Manage Webhooks permission.`);
    console.log('  Opening the invite page again: pick the same server and click Authorize (it updates the permissions).');
    openUrl(invite);
    const a = await ask(`  Press Enter to try again, or paste a webhook URL of #${channel.name} yourself: `);
    if (/^https:\/\/(\w+\.)?discord(app)?\.com\/api\/webhooks\//.test(a)) return a;
  }
}

async function setupDiscord(url, have) {
  const forumNeeded = !state.noForum;
  const need = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'DISCORD_WEBHOOK_URL', ...(forumNeeded ? ['DISCORD_FORUM_WEBHOOK_URL'] : [])];
  if (need.every((k) => have.has(k))) return ok('Already set up (login, bot and webhooks)');

  console.log('  If you haven\'t yet: https://discord.com/developers/applications → New Application (e.g. "GitHub Watcher"),');
  console.log('  then the Bot page → Reset Token → Copy.');
  let token = '';
  let me = null;
  for (;;) {
    token = await ask('  Paste the bot token (hidden, never saved in a file): ', { hidden: true });
    if (!token) continue;
    const r = await discord(token, 'GET', '/applications/@me');
    if (r.ok) { me = r.data; break; }
    warn(r.status === 401 ? 'Discord says this token is invalid. Copy it again (Reset Token gives a new one).' : `Discord answered ${r.status}. Try again.`);
  }
  ok(`Token works: application "${me.name}"`);
  const values = { DISCORD_CLIENT_ID: me.id, DISCORD_BOT_TOKEN: token };

  // the bot in the class server
  const invite = `https://discord.com/oauth2/authorize?client_id=${me.id}&scope=bot&permissions=${BOT_PERMISSIONS}`;
  let guilds = (await discord(token, 'GET', '/users/@me/guilds')).data;
  if (!Array.isArray(guilds) || !guilds.length) {
    console.log('  Opening the invite page: pick your class server and click Authorize.');
    openUrl(invite);
    for (;;) {
      await ask('  Press Enter once the bot is in your server… ');
      guilds = (await discord(token, 'GET', '/users/@me/guilds')).data;
      if (Array.isArray(guilds) && guilds.length) break;
      warn('I don\'t see the bot in any server yet.');
    }
  }
  const guild = guilds.length === 1 ? guilds[0] : await choose(guilds, (g) => g.name, 'Which server is your class?');
  ok(`Server: ${guild.name}`);

  state.guildName = guild.name;
  save();

  // the 2 channels and their webhooks
  if (!have.has('DISCORD_WEBHOOK_URL')) {
    const main = await channelFor(token, guild.id, MAIN_CHANNEL, 0, invite);
    if (!main) fail(`Discord refused to create #${MAIN_CHANNEL}. Create it yourself, then run \`npm run setup\` again.`);
    values.DISCORD_WEBHOOK_URL = await webhookFor(token, main, me.name, invite);
    ok(`Main channel: #${main.name}`);
  }
  if (forumNeeded && !have.has('DISCORD_FORUM_WEBHOOK_URL')) {
    const forum = await channelFor(token, guild.id, FORUM_CHANNEL, 15, invite);
    if (forum) {
      values.DISCORD_FORUM_WEBHOOK_URL = await webhookFor(token, forum, me.name, invite);
      ok(`Forum: #${forum.name} (one thread per student)`);
    } else {
      state.noForum = true;
      save();
      warn('Discord refused to create a forum here: all activity goes to the main channel.');
    }
  }

  // login: Discord never shows the client secret to a bot, so this part is by hand
  if (!have.has('DISCORD_CLIENT_SECRET')) {
    console.log(`\n  Now in the page that opens (your app → ${C.bold('OAuth2')}):`);
    console.log(`   1. ${C.bold('Redirects')} → Add Redirect → paste ${C.bold(`${url}/discord/callback`)} → Save Changes`);
    console.log(`   2. ${C.bold('Client Secret')} → Reset Secret → Copy`);
    openUrl(`https://discord.com/developers/applications/${me.id}/oauth2`);
    for (;;) {
      const secret = await ask('  Paste the client secret (hidden): ', { hidden: true });
      if (!secret) continue;
      const check = await api(DISCORD, 'POST', '/oauth2/token', {
        auth: 'Basic ' + Buffer.from(`${me.id}:${secret}`).toString('base64'),
        form: { grant_type: 'client_credentials', scope: 'identify' },
      });
      if (check.status !== 401) { values.DISCORD_CLIENT_SECRET = secret; break; }
      warn('Discord says this client secret is wrong. Copy it again.');
    }
  }
  await putSecrets(values, have);
}

// ---------------------------------------------------------------- GitHub App
// GitHub's "App Manifest" flow: a pre-filled form, you click Create once, GitHub sends back every key.
async function createGithubApp(url) {
  // GitHub app names are unique: the class server's name makes it yours (you can still edit it on the GitHub page)
  const extra = String(state.guildName || randomKey(3)).replace(/[^\p{L}\p{N} -]/gu, '').trim();
  const name = `GitHub Watcher ${extra}`.slice(0, 34).trim();
  const st = randomKey(16);
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const local = `http://127.0.0.1:${server.address().port}`;
  const manifest = {
    name,
    url,
    description: 'Posts your GitHub activity (commits, pull requests, issues) in your class Discord. Read-only.',
    hook_attributes: { url: `${url}/github/webhook`, active: true },
    redirect_url: `${local}/done`,
    callback_urls: [`${url}/github/callback`],
    setup_url: `${url}/github/setup`,
    setup_on_update: true,
    request_oauth_on_install: false,
    public: true,
    default_permissions: { actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read', metadata: 'read' },
    default_events: GH_EVENTS,
  };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const code = await new Promise((resolve) => {
    server.on('request', (req, res) => {
      const u = new URL(req.url, local);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (u.pathname === '/done' && u.searchParams.get('state') === st && u.searchParams.get('code')) {
        res.end('<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:2em">✅ GitHub App created. You can close this tab and go back to the terminal.');
        resolve(u.searchParams.get('code'));
      } else if (u.pathname === '/') {
        res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:2em">Opening GitHub…
<form id="f" method="post" action="${GITHUB_WEB}/settings/apps/new?state=${st}"><input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}"><button>Continue to GitHub</button></form>
<script>document.getElementById('f').submit()</script>`);
      } else { res.statusCode = 404; res.end('Not found'); }
    });
    console.log(`  Opening GitHub with the form already filled in (app name: "${name}").`);
    console.log(`  Log in if asked, then click ${C.bold('Create GitHub App')}. If GitHub says the name is taken, change it there.`);
    openUrl(local + '/');
    console.log(C.dim('  Waiting for GitHub…'));
  });
  server.close();
  const r = await api(GITHUB, 'POST', `/app-manifests/${encodeURIComponent(code)}/conversions`);
  if (!r.ok) fail(`GitHub answered ${r.status} when sending back the keys. Run \`npm run setup\` again (delete the new app first in GitHub → Settings → Developer settings → GitHub Apps).`);
  const app = r.data;
  if (!app.webhook_secret) {
    app.webhook_secret = randomKey(32);
    const s = await api(GITHUB, 'PATCH', '/app/hook/config', { auth: `Bearer ${appJwt(app.id, app.pem)}`, body: { secret: app.webhook_secret } });
    if (!s.ok) warn(`Couldn't set the webhook secret (GitHub answered ${s.status}). Set it by hand in the app settings.`);
  }
  state.githubApp = { slug: app.slug, id: app.id, url: app.html_url };
  save();
  ok(`GitHub App "${app.name}" created: ${app.html_url}`);
  return {
    GITHUB_APP_SLUG: app.slug,
    GITHUB_APP_ID: String(app.id),
    GITHUB_CLIENT_ID: app.client_id,
    GITHUB_CLIENT_SECRET: app.client_secret,
    GITHUB_WEBHOOK_SECRET: app.webhook_secret,
    GITHUB_PRIVATE_KEY: app.pem,
  };
}

function appJwt(appId, pem) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 60, exp: now + 540, iss: String(appId) })}`;
  return `${data}.${createSign('RSA-SHA256').update(data).sign(pem).toString('base64url')}`;
}

async function setupGithub(url, have) {
  const need = ['GITHUB_APP_SLUG', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_WEBHOOK_SECRET', 'GITHUB_PRIVATE_KEY'];
  if (need.every((k) => have.has(k))) return ok('Already set up');
  if (!have.has('GITHUB_APP_SLUG')) return putSecrets(await createGithubApp(url), have);

  // An app already exists: never create a second one, only fill in what's missing
  if (!have.has('GITHUB_PRIVATE_KEY')) {
    console.log(`  Your GitHub App has no private key in Cloudflare yet (used to count lines in each commit).`);
    console.log(`  GitHub → Settings → Developer settings → GitHub Apps → your app → ${C.bold('Generate a private key')}.`);
    openUrl(`${GITHUB_WEB}/settings/apps`);
    for (;;) {
      const p = (await ask('  Drag the downloaded .pem file here (or type its path), or press Enter to skip: ')).replace(/^["']|["']$/g, '');
      if (!p) { warn('Skipped: commit sizes are not measured until you add GITHUB_PRIVATE_KEY.'); break; }
      const pem = existsSync(p) ? readFileSync(p, 'utf8') : '';
      if (/BEGIN (RSA )?PRIVATE KEY/.test(pem)) { await putSecrets({ GITHUB_PRIVATE_KEY: pem }, have); break; }
      warn('That is not a .pem private key file.');
    }
  }
  const missing = need.filter((k) => !have.has(k));
  if (missing.length) warn(`Still missing: ${missing.join(', ')}. Add them by hand (README, steps 6 and 7).`);
}

// ---------------------------------------------------------------- AI
// Cloudflare's own AI works with no key. A key is optional: it is tried first.
async function setupAi(have) {
  if (have.has('GROQ_API_KEY')) return ok('AI key already set');
  if (state.aiSkipped) return ok('Cloudflare AI (free, no key)');
  console.log('  The AI review uses Cloudflare\'s free AI by default (about 15–20 reviews a day).');
  console.log('  Optional: a free Groq key (https://console.groq.com/keys) is tried first.');
  for (;;) {
    const key = await ask('  AI key (hidden), or press Enter to skip and use Cloudflare AI: ', { hidden: true });
    if (!key) { state.aiSkipped = true; save(); return ok('Cloudflare AI (free, no key)'); }
    if (!key.startsWith('gsk_')) { warn('Only Groq keys (they start with gsk_) work for now. Press Enter to use Cloudflare AI.'); continue; }
    const r = await api(GROQ, 'GET', '/models', { auth: `Bearer ${key}` });
    if (r.status === 401) { warn('Groq says this key is wrong. Copy it again.'); continue; }
    return putSecrets({ GROQ_API_KEY: key }, have);
  }
}

// ---------------------------------------------------------------- password
async function choosePassword(have) {
  console.log('  Only people with this password can open your dashboard (it shows student data).');
  console.log('  Use at least 10 characters, e.g. three random words. Each browser stays signed in for 30 days.');
  let pw = '';
  for (;;) {
    pw = await ask('  New password (hidden): ', { hidden: true });
    if (pw.length < 10) { warn('Too short: use at least 10 characters.'); continue; }
    if ((await ask('  Type it again: ', { hidden: true })) === pw) break;
    warn('The two passwords are different. Try again.');
  }
  // the older ADMIN_KEY (a password in the URL) is removed
  await putSecrets(have.has('ADMIN_KEY') ? { ADMIN_PASSWORD: pw, ADMIN_KEY: null } : { ADMIN_PASSWORD: pw }, have);
  return pw;
}

// ---------------------------------------------------------------- check
async function setupCheck(url, password) {
  const base = process.env.GW_WORKER_URL || url;
  let res = null;
  for (let i = 0; i < 10; i++) { // Cloudflare can take a few seconds to serve the new version with its secrets
    const login = await fetch(`${base}/admin/login`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ password }) }).catch(() => null);
    const cookie = (login?.headers.get('set-cookie') || '').split(';')[0];
    res = login?.status === 303 && cookie ? await fetch(`${base}/admin`, { headers: { cookie } }).catch(() => null) : login;
    if (res?.ok || res?.status === 403 || res?.status === 429) break;
    await sleep(PAUSE);
  }
  if (!res?.ok) return warn(res?.status === 403 ? 'Wrong password: the dashboard refused it.' : `The dashboard didn't answer (${res?.status ?? 'no answer'}). Try it in your browser in a minute.`);
  const m = (await res.text()).match(/<script type="application\/json" id="dash-data">([\s\S]*?)<\/script>/);
  if (!m) return warn('The dashboard answered, but I couldn\'t read its setup check.');
  const S = JSON.parse(m[1]).settings;
  const login = await fetch(`${base}/connect`, { redirect: 'manual' }).catch(() => null);
  const loc = login?.headers.get('location') || '';
  const checks = [
    [/client_id=[^&]+/.test(loc), 'Discord login', 'DISCORD_CLIENT_ID is missing'],
    [S.names?.hasBot, 'Real Discord names', 'DISCORD_BOT_TOKEN is missing'],
    [S.hasForum, 'One thread per student', 'no forum webhook: activity goes to the main channel'],
    [S.hasKey, 'Line counting', 'GITHUB_PRIVATE_KEY is missing'],
    [S.hasAI, 'AI review', 'the AI binding is missing'],
  ];
  for (const [good, name, why] of checks) (good ? ok : warn)(good ? name : `${name}: ${why}`);
}

// =========================================================== time command
async function timeCommand() {
  console.log(C.bold('\n🕔 Change the time of the daily report'));
  if (!state.name || !existsSync(CONFIG)) fail('Run `npm run setup` first.');
  const def = utcToLocal(state.reportUtc || REPORT_UTC);
  for (;;) {
    const t = (await ask(`  New time, your time (${utcOffset()}) [${def}]: `)) || def;
    const m = t.match(/^(\d{1,2})[:h.](\d{2})$/);
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) { state.reportUtc = localToUtc(`${m[1]}:${m[2]}`); break; }
    warn('Type a time like 18:15.');
  }
  save();
  writeConfig();
  await deploy();
  console.log(C.green(`\n🎉 Done: daily report at ${utcToLocal(state.reportUtc)} your time (${state.reportUtc} UTC).\n`));
  rl.close();
}

// ======================================================= password command
async function passwordCommand() {
  console.log(C.bold('\n🔑 Change the dashboard password'));
  if (!state.name || !state.url || !existsSync(CONFIG)) fail('Run `npm run setup` first.');
  const have = (await secretNames()) || new Set();
  await choosePassword(have);
  console.log(C.green(`\n🎉 Done. Every browser is signed out: open ${state.url}/admin and sign in with the new password.\n`));
  rl.close();
}

// ================================================================== main
async function main() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 22) fail(`Node.js 22 or newer is needed (you have ${process.versions.node}). Install the LTS from https://nodejs.org and try again.`);
  const i = process.argv.indexOf('--main');
  if (i > 0) state.main = process.argv[i + 1];
  state.main = (state.main || 'worker.js').replace(/\\/g, '/');
  if (!existsSync(join(ROOT, state.main))) fail(`${state.main} not found.`);

  console.log(C.bold('\n📡 GitHub Watcher setup assistant'));
  console.log('It\'s safe to run this again: finished steps are skipped.');

  // ---------------------------------------------------------------- 1
  step(1, 'Checking the project');
  if (!process.env.GW_WRANGLER && !existsSync(join(ROOT, 'node_modules', 'wrangler'))) {
    warn('Installing the Cloudflare tool (npm install)…');
    const r = await run('npm install', { capture: false });
    if (r.code !== 0) fail('npm install failed. Fix the error above, then run `npm run setup` again.');
  }
  ok('Ready');

  // ---------------------------------------------------------------- 2
  step(2, 'Logging in to Cloudflare');
  const who = await wrangler('whoami', { quiet: true });
  if (who.code !== 0 || /not authenticated|not logged in/i.test(who.out)) {
    console.log('  A browser page opens: log in to Cloudflare (or create a free account) and click Allow.');
    const r = await wrangler('login', { capture: false });
    if (r.code !== 0) fail('Cloudflare login didn\'t finish. Run `npm run setup` again.');
  }
  ok('Logged in');

  // ---------------------------------------------------------------- 3
  step(3, 'Your Worker on Cloudflare');
  state.name ||= WORKER_NAME;
  if (!state.kvId) {
    const spaces = jsonArray((await wrangler('kv namespace list', { quiet: true })).out) || [];
    const same = spaces.find((s) => s.title === KV_NAME);
    if (same) state.kvId = same.id;
    else if (spaces.length) {
      console.log('  Your Cloudflare account already has storage. If one of these holds your students, pick it:');
      const pick = await choose([...spaces, { id: null, title: `create a new one (${KV_NAME})` }], (s) => s.title, 'Which storage should the Worker use?');
      state.kvId = pick.id;
    }
    if (!state.kvId) {
      const r = await wrangler(`kv namespace create ${KV_NAME}`);
      state.kvId = r.out.match(/\b[0-9a-f]{32}\b/)?.[0];
      if (!state.kvId) fail('Couldn\'t create the storage. See the message above.');
    }
    save();
  }
  ok(`Storage: ${state.kvId}`);

  state.reportUtc ||= REPORT_UTC;
  save();
  ok(`Daily report at ${state.reportUtc} UTC, ${utcToLocal(state.reportUtc)} your time (change it with: npm run setup:time)`);
  writeConfig();

  let have = await secretNames();
  if (have) {
    ok(`The Worker "${state.name}" already exists: its students, history and ${have.size} secret(s) are kept.`);
    if (!(await yes(`Upload ${state.main} to it now?`))) fail('Stopped: nothing was changed.');
  }
  have ??= new Set();
  const url = await deploy();
  state.url = url;
  save();
  ok(`Worker online: ${url}`);

  // ---------------------------------------------------------------- 4
  step(4, 'Discord (login, bot, channels)');
  await setupDiscord(url, have);

  // ---------------------------------------------------------------- 5
  step(5, 'GitHub App (students install it)');
  await setupGithub(url, have);

  // ---------------------------------------------------------------- 6
  step(6, 'AI review');
  await setupAi(have);

  // ---------------------------------------------------------------- 7
  step(7, 'Your dashboard password');
  let password = '';
  if (!have.has('ADMIN_PASSWORD')) {
    if (have.has('ADMIN_KEY')) warn('Your dashboard still uses ADMIN_KEY (a password in the address). Choose a real password now: ADMIN_KEY is then removed.');
    password = await choosePassword(have);
  } else {
    ok('Already set (change it with: npm run setup:password)');
    password = await ask('  Type your password to run the setup check (hidden), or press Enter to skip: ', { hidden: true });
  }

  // ---------------------------------------------------------------- 8
  step(8, 'Setup check');
  if (password) await setupCheck(url, password);
  else warn('Skipped');

  console.log(C.bold(C.green('\n🎉 GitHub Watcher is live!')));
  console.log(`\n  ${C.bold('Your dashboard')}: ${url}/admin  (bookmark it, sign in with your password)`);
  console.log(`\n  ${C.bold('Post and pin this in your Discord:')}`);
  console.log(`      📡 Connect your GitHub to share your activity here: ${url}`);
  console.log(`\n  After an update of worker.js: ${C.bold('npm run deploy')}\n`);
  rl.close();
}

({ password: passwordCommand, time: timeCommand }[process.argv[2]] || main)().catch((e) => fail(e?.stack || String(e)));
