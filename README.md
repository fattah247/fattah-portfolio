# Muhammad A. Fattah Portfolio

Engineering portfolio for projects around payment reliability, service observability, and secure Android client behavior. The site is a small retro operating system in the browser: visitors open apps, play through three engineering cases, and read the code and evidence behind each one.

## What is on the site

### Devices

The shell adapts to the device it runs on (`lib/device-capabilities.ts`):

- Desktop: movable, resizable windows that snap to the screen edges and minimize to a taskbar, with app and case shortcuts on the desktop.
- Tablet: apps fill the screen and launch from a shelf. Recents shows every running app, and in landscape Projects and Experience can open side by side.
- Phone: one full-screen app at a time, a fixed Home screen, Recents, and Back that follows the browser history.

### Apps

- Projects: the three cases, public GitHub repositories, and the evidence for each case.
- Experience: role history, scope, and the CV download.
- Contact: email and public profiles.
- Product Links: a searchable list of tools and products.

### Cases

| Case | Repository | Simulator |
|---|---|---|
| Payment reliability | [Payflow Reliability](https://github.com/fattah247/payflow-reliability) | Break the payment |
| Service observability | [iYup](https://github.com/fattah247/iYup) | Website monitor |
| Android device trust | [TrustGate Android](https://github.com/fattah247/trustgate-android) | Payment gate |

Each case reads in order: Story, Result, Try it, Evidence. "Try it" is a live simulator that runs the rules of its repository (`lib/payment-flow.ts`, `lib/uptime.ts`, `lib/device-risk.ts`). A dashed lane labelled "For comparison, not in the repo" runs the same inputs through a simpler system. Simulated values are labelled as simulated.

Every simulator has a "How Payflow / iYup / TrustGate decided" section. It shows the current input, the lines of repository code that decided the result, the answer, and the repository tests that cover it. Code links point to a fixed commit with line numbers. "Technical details" switches the simulator to the repository's own names, and `?technical=1` on a case URL turns it on.

### Routes

| Route | Content |
|---|---|
| `/` | Home |
| `/case/payflow`, `/case/iyup`, `/case/trustgate` | The three cases |
| `/projects/<repository>` | A public GitHub repository |
| `/brief` | Experience |
| `/products` | Product Links |
| `/evidence` | Evidence ledger |

## Tech

- Next.js (App Router) and React
- TypeScript
- Hand-written CSS, with Tailwind CSS as the PostCSS base
- IBM Plex Sans and IBM Plex Mono through Fontsource
- Sound synthesized with Web Audio in a Web Worker; no audio files
- Vitest with Testing Library and jsdom
- Vercel hosting and Vercel Web Analytics

There is no database, server storage, or account system. Browser storage holds only the desktop icon positions, the analytics sampling choice, and the sound level.

## Run locally

Node 22 is used locally and in CI. No env file is needed.

| Purpose | Command |
|---|---|
| Install | `npm ci` |
| Dev server (port 3000) | `npm run dev` |
| Unit tests | `npm test` |
| Type-check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build` |

`GITHUB_TOKEN` is optional. When set, GitHub requests are authenticated, which raises the rate limit. Without it, the site uses the public API and falls back to a bundled project list if GitHub is unavailable.

Projects lists public repositories owned by `fattah247` that carry the `portfolio` topic.

## Project layout

- `app/`: routes and global CSS
- `components/`: client UI: shell, windows, Home, cases, simulators, sound
- `lib/`: case models, repository proofs, navigation, motion, content, GitHub loader
- `lib/sound/`: sound synthesis and playback
- `public/`: CV, logos, and case screenshots
- `design.md`: the design contract for devices, cases, layout, colour, motion, sound, and accessibility

Tests sit next to the code they cover as `*.test.ts` and `*.test.tsx`.

## CI

GitHub Actions runs lint and build on pushes to `main`, `dev`, and `features/**`, and on pull requests to `main` and `dev`.

## Deploy

Deploy on Vercel by importing the repository.

## Free operation contract

The portfolio is designed to run without a paid service:

- GitHub data uses the public REST API. `GITHUB_TOKEN` is optional and does not unlock a paid feature.
- Repository data is cached for six hours and limited to eight portfolio repositories, bounding a refresh to at most nine GitHub requests.
- README requests run at most three at a time under one eight-second budget to avoid bursts and secondary rate limits.
- A bundled repository index keeps Projects usable when GitHub is unavailable or rate-limited.
- Repository previews use ordinary remote images, not metered image optimization.
- There is no database, paid storage, cron job, or paid GitHub application.
- Vercel Web Analytics is limited to a 25% sample of production sessions, respects Do Not Track and Global Privacy Control, records page views only, and removes query strings and hashes before sending.
- Keep Web Analytics on the included Hobby tier. Do not enable Web Analytics Plus; Hobby collection pauses after its included event allowance instead of creating overage charges.

Vercel Hobby is a free plan with usage limits. It does not create usage overage charges; Vercel may pause a Hobby project after its included limits are exhausted. Keep the deployment on Hobby and do not enable a Pro trial or paid team if the requirement is zero billing.
