# Muhammad A. Fattah Portfolio

One-page portfolio for selected engineering projects around payment reliability, observability, and secure Android client behavior.

## Tech

- Next.js
- TypeScript
- Tailwind CSS
- Vercel deployment

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

Deploy on Vercel by importing the repository.

## Free operation contract

The portfolio is designed to run without a paid service:

- GitHub data uses the public REST API. `GITHUB_TOKEN` is optional and does not unlock a paid feature.
- Repository data is cached for six hours and limited to eight portfolio repositories, bounding a refresh to at most nine GitHub requests.
- README requests run sequentially to avoid bursts and secondary rate limits.
- A bundled repository index keeps Projects usable when GitHub is unavailable or rate-limited.
- Repository previews use ordinary remote images, not metered image optimization.
- There is no database, paid storage, cron job, or paid GitHub application.
- Vercel Web Analytics is limited to a 25% sample of production sessions, respects Do Not Track and Global Privacy Control, records page views only, and removes query strings and hashes before sending.
- Keep Web Analytics on the included Hobby tier. Do not enable Web Analytics Plus; Hobby collection pauses after its included event allowance instead of creating overage charges.

Vercel Hobby is a free plan with usage limits. It does not create usage overage charges; Vercel may pause a Hobby project after its included limits are exhausted. Keep the deployment on Hobby and do not enable a Pro trial or paid team if the requirement is zero billing.
