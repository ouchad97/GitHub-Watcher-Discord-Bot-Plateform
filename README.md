# GitHub Watcher

A free bot that posts your students' GitHub activity (commits, branches, pull requests, issues…) in your class Discord. It also sends daily and weekly reports, tracks your briefs and their due dates, and gives you a teacher dashboard.

- **100% free**: it runs on Cloudflare Workers (free plan), with a GitHub App and a Discord app.
- **No server to run.** Everything is in one file: `worker.js`.
- **Students connect themselves** with one link. They choose which repositories to share (private ones too), and they can remove access at any time.
- **Install in about 5 minutes** with one command in a terminal.

---

## Contents

1. [What you get](#what-you-get)
2. [Before you start](#before-you-start)
3. [Install](#install)
4. [Optional settings](#optional-settings)
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
| Briefs with due-date reminders (3 days, 1 day, final summary) and a hand-in page | Main channel |
| Teacher dashboard with password login (students, history, briefs, settings, light/dark) | `YOUR-URL/admin` |
| AI review of a student's code against the commit messages and the brief (optional, only you see it) | Dashboard → student panel |

> In this guide, **YOUR-URL** means your Worker address, for example `https://github-watcher.yourname.workers.dev` (no `/` at the end).

## Before you start

You need three free accounts:

| Account | Link | What for |
|---|---|---|
| Cloudflare | <https://dash.cloudflare.com/sign-up> | Runs the bot and stores the data |
| GitHub | <https://github.com/signup> | The GitHub App your students install |
| Discord | <https://discord.com> | A server where you are an admin (your class server) |

The bot posts in two channels: `#github-activity` (reports, alerts, briefs) and the forum `github-students` (one thread per student). The install creates them for you.

---

## Install

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

## Optional settings

Change these only if you want other defaults. In Cloudflare: **Workers & Pages** → `github-watcher` → **Settings** → **Variables and Secrets** → **Add** → type **Text**. `npm run deploy` keeps them.

| Name | Default | Meaning |
|---|---|---|
| `SKIP_DAYS` | `sat,sun` | Days without a daily report (`none` = every day) |
| `WEEKLY_DAY` | `fri` | Day of the weekly summary |
| `INACTIVE_DAYS` | `3` | Working days with no activity before a student is pinged |
| `TINY_LINES` | `2` | Commits with this many changed lines or fewer are "tiny" (not scored) |
| `HUGE_LINES` | `2000` | Commits with this many lines or more are "huge" (not scored) |
| `IGNORE_EVENTS` | — | Events never posted, e.g. `fork,issue_comment` |

The time of the daily report is changed with `npm run setup:time`.

**AI review:** Cloudflare's own AI is on by default (no key, about 15–20 reviews a day for free; the count resets at 00:00 UTC). A free Groq key (<https://console.groq.com/keys>) is optional: `npm run setup` asks for it. If it is set, Groq is tried first and Cloudflare AI is the backup; if Groq refuses your Worker, it is skipped automatically for a few hours.

---

## Using the dashboard

Open `YOUR-URL/admin` and sign in with your password. Your browser stays signed in for 30 days. You can sign out in **Settings** → **Account**.

- **Overview**: class register (14 days), scores, students who need attention, briefs.
- **Students**: search, filter, sort. **Filter by brief**: choose a brief to see each student's squad, repo handed in and push status (on time / late / nothing pushed), and keep only one squad, the students who handed in or not, or those late. Click a student for their history and repos, and for "Change name" or "Stop tracking".
- **Briefs**: create a brief (name, from → due date: pushes count from the first date), see who pushed, post the status in Discord. Each brief card shows its dates, the progress bar, then sections you open: **Who pushed**, **Hand-ins** (or **Squads & debriefing**), **Brief & evaluation grid**, **Type & squads**.
  - **Individual or squad brief**: choose the type when you create the brief. For a squad brief, make the squads: a name, the members (add them from the list; a student is in one squad only) and the **Scrum Master**. **Copy the squads of…** reuses the squads of another brief. You can change them later in **Squads**.
  - **Hand-in page** (`YOUR-URL/submit`): students log in with Discord, choose the brief and paste the link of their GitHub repo. For a squad brief, only the Scrum Master hands in the squad repo. The bot checks that it can read the repo, and notes the date (on time or late). They can also give their **planning link** (optional): a Trello board, a Jira project or a GitHub Project. A **public Trello board** is read with no key: cards done / in progress / to do, and cards per member (shown in the review and in each member's comment). A GitHub Project is only checked to be public, and a Jira link is only shown (both tools do not let the bot read the tasks). The link is in the Discord announcement of the brief and in the reminders. On the brief you see every hand-in and can set, fix or remove any of them. A review always reads the repo handed in: nothing to guess.
  - **Steps** (optional): when the brief cuts the project into parts with dates (e.g. *Partie 1, fin du jour 1 : …*), the AI finds them when it makes the grid. Each step gets its date (day N of the brief, at the brief's due time). You can change them in **Brief & evaluation grid** → **Steps**: one line `name | YYYY-MM-DD HH:MM | what is expected` (UTC).
    - In the student panel (and the squad debriefing), choose the brief: each step has **Propose validation**. The platform reads the repo handed in as it was at the step's date (files and commits before / after) and proposes **On time**, **Late**, **Not validated** or **To check**. You decide: click **On time / Late / Not validated** and add a note if you want.
    - **Generate comment** adds a **Suivi du projet** part: your result for each step, and a line when most commits came during the last step (work done at the end). Competencies are never changed for you: you decide.
  - **Squad debriefing**: click **Debriefing** on a squad, then **Analyze the squad repo**. You get:
    - the squad review (the brief grid, switches, the squad's challenge) and the **squad comment** ("Bonjour chers …", written to the whole squad);
    - **each member's part**, from GitHub: commits, active days, pull requests, reviews, and whether they are a collaborator. A member with **no commit** in the squad repo is flagged: to check at the debriefing;
    - Git checks for the team: every member committed, pull requests approved before the merge;
    - **one card per member**: quiz %, their own competencies (they start from the squad's; switch them per person), the challenge result (the squad's challenge, or **a different one** for that member), your note, then **Generate the members' comments**: one comment each, with their role (Scrum Master), their part, quiz %, challenge and competencies.
- **AI review** (student panel):
  1. In **Briefs**, create a brief (or open one) → **Import brief page (.html)**. This is the brief page saved from Simplonline, e.g. with the SingleFile extension; click "voir le détail" first so all competencies are on the page. The name, the brief text and the competencies with their levels are filled in (e.g. `C1N1, C3N1, CT1N1, CT5N1`: **C** = technical, **CT** = transversal competency, **N** = level). You can correct the codes. The repo name is optional (only a preference).
  2. **Evaluation grid**: when you save the brief, the AI reads it once and lists **everything the brief asks, and nothing else**. Any kind of project works: HTML/CSS, JavaScript, PHP, POO, SQL, MVC, Laravel, API…
     - One line per requirement: `[type] requirement (vérif : check)`. Types: **fonctionnalité**, **technique**, **livrable**, **critère**, **bonus**, **oral** (presentation, quiz: seen outside the code).
     - `vérif` names the automatic checks that prove the line, e.g. `(vérif : php_pdo, php_prepared)`. The AI chooses them (HTML/CSS, JavaScript, PHP/POO, security, SQL, Laravel, API, tests, UML…); the full list is `CHECK_IDS` in `worker.js`. A line without `vérif` is judged by the AI from the code.
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
- If something leaks: reset it (Discord → **Reset Token** / delete the webhook; GitHub → new client secret / new private key), delete that secret in Cloudflare (**Settings** → **Variables and Secrets**), then run `npm run setup` again: it asks only for what is missing.
- Turn on 2-factor authentication on Cloudflare, GitHub and Discord.
- Older installs used `ADMIN_KEY` and links like `YOUR-URL/admin?key=…`. Those links still work once, then the key is removed from the address bar. Replace `ADMIN_KEY` with `ADMIN_PASSWORD` (`npm run setup` does it for you and removes `ADMIN_KEY`).

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` or `node` is not recognized | Install Node.js (Install, step 1), then close and reopen the terminal |
| `npm run setup` says "Missing script" | The terminal is not in the GitHub Watcher folder. Open the terminal in that folder (Install, step 3) |
| The bot can't create a channel or a webhook | Click **Authorize** again on the invite page the assistant opens (it adds the Manage Channels / Manage Webhooks permission) |
| GitHub says the app name is taken | Change the name on the GitHub page, then click **Create GitHub App** |
| `redirect_uri invalid` on Discord login | The redirect must be exactly `YOUR-URL/discord/callback` (Discord → your app → **OAuth2** → **Redirects**) |
| Forgot the dashboard password | Run `npm run setup:password`, or change the `ADMIN_PASSWORD` secret in Cloudflare |
| "Too many tries" on the login page | Wait one minute, then type the password again |
| Student connected but nothing is posted | GitHub → **Settings** → **Developer settings** → **GitHub Apps** → your app → **Advanced** → **Recent Deliveries** shows the errors. The webhook URL must be `YOUR-URL/github/webhook` |
| Error 1031 / preview error | Use the normal `workers.dev` URL, not the preview URL |
| Names are GitHub usernames | Run `npm run setup` again (it checks the bot token and invites the bot), then dashboard → **Settings** → refresh names |
| Threads are not renamed | The bot needs **Manage Threads** in the forum channel |
| "Line counting" not green | Run `npm run setup` again: it asks for the GitHub App's private key (.pem file) |
| AI review: "Cloudflare AI free daily limit reached" | About 15–20 reviews a day are free. Wait until tomorrow (00:00 UTC) |
| AI review: "small AI model" warning | The big model was busy or refused: click Analyze again later |
| AI review: Groq error 403 "Access denied" | Groq blocks your Worker's network: Cloudflare AI is used instead, and Groq is skipped automatically for a few hours |
| No daily report | Check that today is not a skip day (`SKIP_DAYS`). After a clock change (summer time), run `npm run setup:time` |

**Free plan limits:** fine for a class of about 30–40 students. One Worker = one class / Discord server. For another class, use another copy of the folder and run `npm run setup` in it (another Worker, GitHub App and channels).
