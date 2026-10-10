# GitHub Watcher

A free bot that posts your students' GitHub activity (commits, branches, pull requests, issues…) in your class Discord. It also sends daily and weekly reports, tracks deadlines and gives you a teacher dashboard.

- **100% free**: it runs on Cloudflare Workers (free plan), with a GitHub App and a Discord app.
- **No server to run.** Everything is in one file: `worker.js`.
- **Students connect themselves** with one link. They choose which repositories to share (private ones too), and they can remove access at any time.
- **Install in about 5 minutes** with one command, or in about 30 minutes by hand in your browser.

---

## Contents

1. [What you get](#what-you-get)
2. [Before you start](#before-you-start)
3. [Quick install (recommended)](#quick-install-recommended)
4. [Manual install (no terminal)](#manual-install-no-terminal)
5. [Using the dashboard](#using-the-dashboard)
6. [Students: privacy and removal](#students-privacy-and-removal)
7. [Security](#security)
8. [Troubleshooting](#troubleshooting)

---

## What you get

| Feature | Where |
|---|---|
| Live activity (pushes, branches, PRs, issues, failed CI…) | One forum thread per student (or one channel) |
| Daily ranking table (score, commits, lines, PRs) | Main channel, every working day |
| Weekly summary with trend | Main channel, every Friday |
| Inactive students alert (pings them) | Main channel |
| Commit quality checks (vague messages, tiny / huge commits, node_modules) | In each activity message |
| Deadlines with reminders (3 days, 1 day, final summary) | Main channel |
| Teacher dashboard with password login (students, history, deadlines, settings, light/dark) | `YOUR-URL/admin` |
| AI review of a student's code against the commit messages and the brief (optional, only you see it) | Dashboard → student panel |

> In this guide, **YOUR-URL** means your Worker address, for example `https://github-watcher.yourname.workers.dev` (no `/` at the end).

## Before you start

You need three free accounts:

| Account | Link | What for |
|---|---|---|
| Cloudflare | <https://dash.cloudflare.com/sign-up> | Runs the bot and stores the data |
| GitHub | <https://github.com/signup> | The GitHub App your students install |
| Discord | <https://discord.com> | A server where you are an admin (your class server) |

The bot posts in two channels: `#github-activity` (reports, alerts, deadlines) and the forum `github-students` (one thread per student). The quick install creates them for you. With the manual install, you create them yourself (Step 4).

---

## Quick install (recommended)

An assistant in your terminal does almost everything for you. You only copy two values from Discord and click a few buttons.

### 1. Install Node.js

Download the **LTS** version from <https://nodejs.org> and install it (Next → Next → Finish).
You need version 22 or newer. To check, open a terminal and type `node --version`.

> **Terminal**: on Windows, open the Start menu and type **Terminal** (or **PowerShell**). On a Mac, open **Terminal** from Applications → Utilities.

### 2. Download GitHub Watcher

On this repository's GitHub page, click **Code** → **Download ZIP**, then unzip it. Or, if you use git:

```
git clone https://github.com/ouchad97/GitHub-Watcher-Discord-Bot-Plateform.git
```

### 3. Run the assistant

Open a terminal **in the downloaded folder**. On Windows: open the folder, right-click an empty space → **Open in Terminal**. On a Mac: type `cd `, drag the folder into the terminal window, then press Enter. Then run:

```
npm run setup
```

The first time, it installs the Cloudflare tool (1 or 2 minutes).

### 4. Answer the questions

The assistant goes through 8 steps. Here is what to do at each one:

| Step | What you see | What you do |
|---|---|---|
| **Cloudflare** | A browser page opens | Log in (or create a free account) and click **Allow** |
| **Your Worker** | Nothing to answer: it is named `github-watcher`, and the daily report goes out at 17:15 UTC | Sometimes "needs a free workers.dev subdomain": choose a name in the page that opens, then press **Enter** |
| **Discord** | `Paste the bot token` | Open <https://discord.com/developers/applications> → **New Application** (e.g. "GitHub Watcher") → **Bot** → **Reset Token** → **Copy**, then paste it. It stays hidden on screen |
| | An invite page opens | Pick your class server → **Authorize**. The bot then creates `#github-activity` and the forum `github-students` (it reuses them if they exist) |
| | The **OAuth2** page of your app opens | 1. **Redirects** → **Add Redirect** → paste the address the assistant shows → **Save Changes**. 2. **Client Secret** → **Reset Secret** → **Copy**, then paste it |
| **GitHub App** | GitHub opens with the whole form already filled in (name: "GitHub Watcher" + your server's name) | Log in if asked, then click **Create GitHub App**. The app ID, client ID, client secret, webhook secret and private key are saved for you |
| **AI review** | `AI key, or press Enter to skip` | Press **Enter** to use Cloudflare's free AI. Or paste a free Groq key (<https://console.groq.com/keys>): it is tried first |
| **Password** | `New password` | Choose your dashboard password (at least 10 characters, e.g. three random words). Type it twice |
| **Setup check** | A list of ✔ | Nothing to do. A `!` line tells you what is missing |

At the end you get:

- **your dashboard**: `YOUR-URL/admin`. Bookmark it and sign in with your password;
- **the message to pin in Discord**:

> 📡 Connect your GitHub to share your activity here: **YOUR-URL**

That's it. Students click the link → log in with Discord → install the GitHub App (choosing their repos) → ✅ they appear in the channel. Their next push is posted.

### Later

| You want to… | Run |
|---|---|
| Change the dashboard password | `npm run setup:password` |
| Change the time of the daily report (e.g. after a clock change) | `npm run setup:time` |
| Install a new version of `worker.js` | Download the new version into the same folder, then run `npm run deploy` |
| Finish a skipped step | `npm run setup` again (finished steps are skipped, nothing is created twice) |
| See the live logs | `npm run logs` |

Your settings stay on your computer, in `.setup.json` and `wrangler.local.jsonc`. Your secrets (tokens, keys, password) go only to Cloudflare, encrypted. They are never saved in a file.

---

## Manual install (no terminal)

Everything is done in the browser. Do the steps in order.

### Step 1 — Cloudflare Worker

1. Create a free account: <https://dash.cloudflare.com/sign-up>
2. **Workers & Pages** → **Create** → **Start with Hello World** → name it `github-watcher` → **Deploy**.
3. Copy your Worker address. This is **YOUR-URL**.
4. Click **Edit code**, delete everything, paste all of `worker.js`, click **Deploy**.

### Step 2 — Storage (KV)

1. **Storage & Databases** → **Workers KV** → **Create** → name `github-watcher-db`.
2. Open your Worker → **Bindings** → **Add binding** → **KV namespace**:
   - Variable name: `DB` (capital letters)
   - KV namespace: `github-watcher-db`

### Step 3 — Daily report schedule (Cron)

Your Worker → **Settings** → **Trigger Events** → **Add** → **Cron Triggers** → enter:

```
15 17 * * *
```

This runs every day at **17:15 UTC**. Change it to your time **in UTC**: for example, 18:00 in UTC+1 is `0 17 * * *`.
If you change it, also add the variable `REPORT_TIME_UTC` with the same time (e.g. `17:00`), see Step 8.

### Step 4 — Discord webhooks

You need **2 webhooks** in your class Discord server:

**A. Main channel** (reports, alerts, deadlines)
Text channel (e.g. `#github-activity`) → ⚙️ **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook** → **Copy Webhook URL**.
→ This is `DISCORD_WEBHOOK_URL`.

**B. Forum channel** (one thread per student, recommended)
**Create Channel** → type **Forum** (e.g. `github-students`) → ⚙️ **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook** → **Copy Webhook URL**.
→ This is `DISCORD_FORUM_WEBHOOK_URL`.
(Optional: if you skip it, all activity goes to the main channel.)

### Step 5 — Discord app (login + bot)

1. Go to <https://discord.com/developers/applications> → **New Application** (e.g. `GitHub Watcher`).
2. **OAuth2** page:
   - Copy **Client ID** → `DISCORD_CLIENT_ID`
   - **Reset Secret** → copy **Client Secret** → `DISCORD_CLIENT_SECRET`
   - **Redirects** → **Add Redirect** → `YOUR-URL/discord/callback` → **Save Changes**
3. **Bot** page (shows students' real Discord names and names their threads):
   - **Reset Token** → copy it → `DISCORD_BOT_TOKEN`
   - Turn **Public Bot** off (optional).
4. Invite the bot to your server: open this link (replace `CLIENT_ID`), pick your server, **Authorize**:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot&permissions=17179870208
```

It only gets **View Channels** + **Manage Threads**. It does not read messages.

### Step 6 — GitHub App

Go to <https://github.com/settings/apps/new> and fill in:

| Field | Value |
|---|---|
| GitHub App name | e.g. `MyClass Watcher` (students see this, must be unique) |
| Homepage URL | `YOUR-URL` |
| Callback URL | `YOUR-URL/github/callback` |
| Request user authorization (OAuth) during installation | ❌ unchecked |
| Setup URL | `YOUR-URL/github/setup` |
| Redirect on update | ✅ checked |
| Webhook → Active | ✅ checked |
| Webhook URL | `YOUR-URL/github/webhook` |
| Webhook secret | any long random text: keep it → `GITHUB_WEBHOOK_SECRET` |

**Repository permissions** → **Read-only** for: **Actions**, **Contents**, **Issues**, **Pull requests**. (Metadata is read-only automatically.) Nothing else.

**Subscribe to events**: Create, Delete, Push, Pull request, Pull request review, Pull request review comment, Issues, Issue comment, Commit comment, Release, Repository, Fork, Workflow run.

**Where can this GitHub App be installed?** → **Any account** → **Create GitHub App**.

Then on the app page:

1. Copy **Client ID** → `GITHUB_CLIENT_ID`
2. **Generate a new client secret** → copy → `GITHUB_CLIENT_SECRET`
3. Your app link is `https://github.com/apps/your-app-name`. The last part is the slug → `GITHUB_APP_SLUG`
4. Scroll down → **Private keys** → **Generate a private key**. A `.pem` file downloads. Open it with Notepad and copy **everything** (including the `-----BEGIN…` and `-----END…` lines) → `GITHUB_PRIVATE_KEY`
   (used to count lines in each commit)

### Step 7 — Secrets in Cloudflare

Your Worker → **Settings** → **Variables and Secrets** → **Add** → Type **Secret**, one per line:

| Name | Value |
|---|---|
| `DISCORD_WEBHOOK_URL` | Step 4A |
| `DISCORD_FORUM_WEBHOOK_URL` | Step 4B |
| `DISCORD_CLIENT_ID` | Step 5 |
| `DISCORD_CLIENT_SECRET` | Step 5 |
| `DISCORD_BOT_TOKEN` | Step 5 |
| `GITHUB_APP_SLUG` | Step 6 |
| `GITHUB_CLIENT_ID` | Step 6 |
| `GITHUB_CLIENT_SECRET` | Step 6 |
| `GITHUB_WEBHOOK_SECRET` | Step 6 |
| `GITHUB_PRIVATE_KEY` | Step 6 (content of the .pem file) |
| `ADMIN_PASSWORD` | your dashboard password: at least 10 characters, e.g. three random words |

Click **Deploy**. The names must be written exactly like this (capital letters).

### Step 8 — Optional settings

Add these as **Text** variables only if you want to change the defaults:

| Name | Default | Meaning |
|---|---|---|
| `REPORT_TIME_UTC` | `17:15` | Must match your cron time (Step 3). A "day" runs from this time to the same time the next day |
| `SKIP_DAYS` | `sat,sun` | Days without a daily report (`none` = every day) |
| `WEEKLY_DAY` | `fri` | Day of the weekly summary |
| `INACTIVE_DAYS` | `3` | Working days with no activity before a student is pinged |
| `TINY_LINES` | `2` | Commits with this many changed lines or fewer are "tiny" (not scored) |
| `HUGE_LINES` | `2000` | Commits with this many lines or more are "huge" (not scored) |
| `IGNORE_EVENTS` | — | Events never posted, e.g. `fork,issue_comment` |

These variables also work with the quick install: add them in the Cloudflare dashboard, and `npm run deploy` keeps them.

**AI review (optional, free).** Your Worker → **Bindings** → **Add binding** → **Workers AI** → variable name `AI` → **Deploy**. (The quick install adds it for you.) This is Cloudflare's own AI: no key, about 15–20 reviews per day for free (the count resets every day at 00:00 UTC). A Groq key (<https://console.groq.com/keys>, secret `GROQ_API_KEY`) is optional. If it is set, Groq is tried first and Cloudflare AI is the backup; if Groq refuses your Worker, it is skipped automatically for a few hours. Optional variables: `GROQ_MODEL`, `WORKERS_AI_MODEL`.

### Step 9 — Check and share

1. Open your dashboard: `YOUR-URL/admin` → sign in with your password → **Settings** → **Setup check**. Everything should be green.
2. Post and pin this in your Discord:

> 📡 Connect your GitHub to share your activity here: **YOUR-URL**

---

## Using the dashboard

Open `YOUR-URL/admin` and sign in with your password. Your browser stays signed in for 30 days. You can sign out in **Settings** → **Account**.

- **Overview**: class register (14 days), scores, students who need attention, deadlines.
- **Students**: search, filter, sort. Click a student for their history and repos, and for "Change name" or "Stop tracking".
- **Deadlines**: create a deadline (name, due date, "Count pushes from"), see who pushed, post the status in Discord.
- **AI review** (student panel):
  1. In **Deadlines**, open a deadline → **Add a brief** → **Import brief page (.html)**. This is the brief page saved from Simplonline, e.g. with the SingleFile extension; click "voir le détail" first so all competencies are on the page. The name, the brief text and the competencies with their levels are filled in (e.g. `C1N1, C3N1, CT1N1, CT5N1`: **C** = technical, **CT** = transversal competency, **N** = level). You can also paste the brief and type the codes. The repo name is optional (only a preference).
  2. **Evaluation grid**: when you save the brief, the AI reads it once and lists **everything the brief asks, and nothing else**. Any kind of project works: HTML/CSS, JavaScript, PHP, POO, SQL, MVC, Laravel, API…
     - One line per requirement: `[type] requirement (vérif : check)`. Types: **fonctionnalité**, **technique**, **livrable**, **critère**, **bonus**, **oral** (presentation, quiz: seen outside the code).
     - `vérif` names the automatic checks that prove the line, e.g. `(vérif : php_pdo, php_prepared)`. The list of checks is under the grid (HTML/CSS, JavaScript, PHP/POO, security, SQL, Laravel, API, tests, UML…).
     - **Check the grid**: delete a line to ignore it, add a line to check more, then **Save brief**. Only these lines are evaluated: a PHP brief gets no HTML advice, unless it asks for HTML.
     - A new brief text makes a new grid. **Make the grid again with AI** does it on demand. Without AI, the grid is made from the brief's sections.
     - Briefs saved before this version have no grid: they keep the older checklist until you click **Make the evaluation grid**.
  3. Open a student → **AI review** → the running brief is preselected → **Analyze** (about 1 minute).
  4. You get:
     - **sure checks**: only the checks named in the grid (plus Git, always judged), e.g. pages, menu, semantic tags, responsive and the brief's screen sizes, W3C for an HTML brief; `fetch`, events, REGEX for a JavaScript brief; classes, encapsulation, inheritance, PDO and prepared queries, SQL file for a PHP brief; migrations, Form Requests, Repository, JWT, Stripe, tests, Swagger for a Laravel API. Tailwind and Bootstrap are understood;
     - **each line of the grid**, with its proof;
     - a **suggestion per competency** (your decision stays on Simplonline);
     - the **commits vs messages**;
     - a **feedback draft** written from the sure checks, which you can edit and copy.
  5. Every line (requirement, sure check, competency) has a switch: **Valid** (green) or **Not valid** (red). The AI and the checks set the first state; click to change it. A requirement proved by a check moves with that check. Things the code cannot show (oral, meeting) start as Valid: your call.
  6. **Mise en situation** (optional): click **Propose a challenge**. The AI picks one user story of the brief at random (done or not) and writes one small task at the brief's level: 10 min at level 1, 15 min at level 2, 20 min at level 3.
     - It is always a small slice, never a whole page, and uses only the brief's technologies (a PHP task for a PHP brief; no JavaScript in an HTML/CSS brief; no new feature, no bonus).
     - A story the learner did becomes a "show me you master it" task; a story not done becomes a "show me you understand how to do it" task.
     - The learner does it in front of you. Click **Copy for the learner**, then choose **Valid / Partly valid / Not valid** and add a comment if you want. **Another challenge** picks a new one.
  7. Click **Generate comment**: the comment for the learner is written from your final switches and the challenge result (and saved with them). Edit it if needed, then click **Copy comment**.
     - The comment has a part per topic of the grid: Fonctionnalités, Intégration, Responsive, JavaScript, POO / Architecture, Base de données, Sécurité, API, Tests, Bonnes pratiques…
     - Bonus lines are optional (performance): praised when done. A bonus not done is never a fault, it is only suggested at the end: *"Pour progresser, tu peux aussi essayer ce bonus : …"*.
     - The comment always has a **Git / GitHub** part: number and regularity of commits, clarity and style of the messages (feat:, fix:…), and branches / merges when the learner uses them.
  8. Students keep their report and their planning link in the README: CT5 is judged on the README, CT1/CT2 on the planning link found there. Other transversal points are seen orally, so the AI never claims they are validated without proof.

  Nothing is posted in Discord. You can add your own evaluation criteria per competency level in `REF_CRITERIA` in `worker.js` (keys `C1`…`C8`, and `T1`…`T9` for CT1…CT9).
- **Settings**: account (sign out), light/dark theme, refresh real names, send reports now (preview / daily / weekly), hidden repos, setup check.

**Scoring:** Score = real commits + pull requests + other activity. Tiny commits, docs-only commits and huge commits (e.g. `node_modules`) are shown with a warning but not scored. Vague messages (`update`, `fix`, `.`) are flagged.

## Students: privacy and removal

- Students choose exactly which repositories are shared. Access is **read-only**.
- To stop: GitHub → **Settings** → **Applications** → **Installed GitHub Apps** → your app → **Uninstall**.
- A student can also ask you to hide a single repo (dashboard → **Settings** → **Hidden repos**).
- Activity statistics are kept for **15 days** only.
- If you use the AI review, the analyzed code is sent to the AI service (Cloudflare and/or Groq), and the home page HTML is sent to the W3C validator. Tell your students.

## Security

- **Never share** your secrets: webhook URLs, bot token, client secrets, private key, dashboard password. Anyone with a webhook URL can post in your channel.
- The dashboard password is never put in a web address. After 5 wrong tries, that connection must wait one minute.
- Changing the password (`npm run setup:password`, or the `ADMIN_PASSWORD` secret in Cloudflare) signs out every browser.
- If something leaks: reset it (Discord → **Reset Token** / delete the webhook; GitHub → new client secret / new private key), then update the secret in Cloudflare and **Deploy**. With the quick install, you can delete the secret in Cloudflare and run `npm run setup` again.
- Turn on 2-factor authentication on Cloudflare, GitHub and Discord.
- Older installs used `ADMIN_KEY` and links like `YOUR-URL/admin?key=…`. Those links still work once, then the key is removed from the address bar. Replace `ADMIN_KEY` with `ADMIN_PASSWORD` (`npm run setup` does it for you and removes `ADMIN_KEY`).

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` or `node` is not recognized | Install Node.js (quick install, step 1), then close and reopen the terminal |
| `npm run setup` says "Missing script" | The terminal is not in the GitHub Watcher folder. Open the terminal in that folder (quick install, step 3) |
| The bot can't create a channel or a webhook | Click **Authorize** again on the invite page the assistant opens (it adds the Manage Channels / Manage Webhooks permission) |
| GitHub says the app name is taken | Change the name on the GitHub page, then click **Create GitHub App** |
| `redirect_uri invalid` on Discord login | The redirect must be exactly `YOUR-URL/discord/callback` (Discord → your app → **OAuth2** → **Redirects**) |
| Forgot the dashboard password | Run `npm run setup:password`, or change the `ADMIN_PASSWORD` secret in Cloudflare |
| "Too many tries" on the login page | Wait one minute, then type the password again |
| Student connected but nothing is posted | Check the GitHub App webhook URL and secret (Step 6). In the app → **Advanced** → **Recent Deliveries** you can see the errors |
| Error 1031 / preview error | Use the normal `workers.dev` URL, not the preview URL |
| Names are GitHub usernames | Add `DISCORD_BOT_TOKEN` and invite the bot (Step 5), then **Settings** → refresh names |
| Threads are not renamed | The bot needs **Manage Threads** in the forum channel |
| "Line counting" not green | Add `GITHUB_PRIVATE_KEY` (the whole .pem content) |
| AI review: "Cloudflare AI free daily limit reached" | About 15–20 reviews a day are free. Wait until tomorrow (00:00 UTC) |
| AI review: "small AI model" warning | The big model was busy or refused: click Analyze again later |
| AI review: Groq error 403 "Access denied" | Groq blocks your Worker's network. Add the Workers AI binding `AI`; Groq is then skipped automatically |
| No daily report | Check the cron (Step 3) and that today is not a skip day. After a clock change (summer time), run `npm run setup:time` |

**Free plan limits:** fine for a class of about 30–40 students. One Worker = one class / Discord server. For another class, repeat the setup with another Worker name, GitHub App and channels. With the quick install, use another copy of the folder.
