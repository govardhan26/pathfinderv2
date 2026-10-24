# Pathfinder

A free, mobile-first web app (installable PWA) that helps college students in rural India understand their
syllabus, pick a tech career direction, follow a weekly plan, ask an AI guide, and reach mentors.
English, Hindi and Tamil interface. Students sign in; progress is saved to their account and cached on their phone.

## What is inside

| Part | What it does |
|---|---|
| Sign in / Create account | Email or mobile number plus password. Progress follows the student to any phone |
| First page | Pick the support needed (learn a topic, career help, mentorship, one-on-one session), optional note, year, coding level and career direction, then **Submit** |
| Careers | 6 tech paths with an 8-step roadmap each |
| My syllabus | Tick subjects, see match and gaps for each career, with free ways to fill gaps |
| My plan | One step at a time, proof of work notes and links, weekly streak |
| Ask AI | Chat with voice input and read-aloud, in 3 languages. Built-in fallback if AI is offline |
| Mentors | Group office hours, free webinars (add to calendar), anonymous questions, public answer board, 1:1 request that unlocks after 3 finished steps |
| `/mentor` | Mentor console (passcode): support requests, anonymous questions, student password reset |

## Deploy on Cloudflare Pages

### Option A: connect a Git repo (recommended)
1. Push this folder to GitHub.
2. Cloudflare dashboard, Workers & Pages, Create, Pages, Connect to Git.
3. Build command: leave empty. Build output directory: `public`. Root directory: the folder that holds `public` and `functions`.
4. Deploy. The `functions/` folder is picked up automatically.

### Option B: direct upload from your computer
```
npm i -g wrangler
wrangler login
wrangler pages deploy public --project-name pathfinder
```
Run it from this folder so `functions/` is included.

## Turn on the server features (Settings, Bindings and Variables, then redeploy)

| Feature | What to add |
|---|---|
| **Accounts, saved progress, support requests, anonymous questions, mentor console** | Create a KV namespace (Storage and databases, KV). Add a **KV binding** named `PF_KV`. Add secret `MENTOR_PASSCODE` (a long phrase mentors share) |
| AI chat with Claude | Add secret `ANTHROPIC_API_KEY`. Optional `ANTHROPIC_MODEL` (default `claude-haiku-5-5`) |
| AI chat, free alternative | Add a **Workers AI binding** named `AI`. Optional `AI_MODEL`. Quality in Hindi and Tamil is weaker than Claude |
| Lock the API to your domain | Optional `ALLOWED_ORIGIN`, for example `https://pathfinder.pages.dev`. By default the API already only accepts requests from its own site |

**Without `PF_KV` nobody can sign in.** The login page then says accounts are not switched on and offers
"Continue on this phone without an account" (progress stays on that phone, nothing reaches mentors).

## How accounts work
- Passwords are hashed with PBKDF2 (100,000 rounds, per-user salt) and never stored or shown. Sessions last 30 days in an HttpOnly cookie.
- Repeated wrong passwords lock that account for about 15 minutes.
- **No email is sent**, so there is no self-service reset. A mentor resets it in `/mentor` (Reset a student password), gives the student a temporary password, and the student is signed out everywhere.
- Contact details (email or mobile) are shown to mentors **only** on requests where the student chose Mentorship or One-on-one session. The sign-up and first page both say so.
- Anonymous questions are never linked to an account, and are kept only on the phone, not in saved progress.
- Signing out removes the saved progress from that phone (it stays in the account). Good for shared phones.
- A student has one open support request. Submitting again replaces it until a mentor marks it handled.

## Make it yours (edit `public/js/data.js`)
- `PF.config.mentors`, `officeHours`, `webinars`, `oneToOneUrl`: these are **sample data**. Replace them.
- `PF.roles`: careers and their 8 steps. `PF.subjects`: syllabus subjects and free resources.
- Interface text in 3 languages is in `public/js/i18n.js`. Career content is English for now; the AI explains in the student's language.
- After changing static files, bump `CACHE` in `public/sw.js` so phones refresh.

## Before the pilot
- Add a Cloudflare **Rate limiting rule** for `/api/*` (the built-in limiter is best effort and also protects your AI bill).
- Students are mostly adults, but some may be 17. Get college sign-off and a short consent note, and decide who may see contact details.
- The AI is told to point distressed students to Tele-MANAS (14416). Mentors should know how to escalate too.
- Voice input uses the browser's speech service (Chrome on Android works best); audio may go to the browser vendor.
- Keep an eye on KV free limits (1,000 writes per day). Each sign-up or sign-in, each saved progress change (batched, at most one every ~2 seconds), support request, question and answer is a write. A class of 100 active students can reach this in a day; the Workers Paid plan removes the limit.

## Try it on your computer
`npx wrangler pages dev public` (run in this folder) serves the site and the functions together. Add a KV binding on the command line, for example `--kv PF_KV --binding MENTOR_PASSCODE=test`.

## Files
```
public/          static site (HTML, CSS, JS, icons, service worker)
functions/api/   chat.js, questions.js, mentor.js (Cloudflare Pages Functions)
functions/_lib/  shared helpers
```
