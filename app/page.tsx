import Image from "next/image";
import { CopyEmailButton } from "@/components/copy-email-button";

const navLinks = [
  { label: "Work", href: "#work" },
  { label: "Projects", href: "#projects" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#contact" },
];

const heroLinks = [
  { label: "GitHub", href: "https://github.com/fattah247" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/muhammad24fattah/" },
];

const focusAreas = [
  {
    title: "Transaction reliability",
    body:
      "Retries, duplicate webhooks, settlement boundaries, and reconciliation drift are where payment-like systems stop being simple CRUD.",
    proofs: [
      "Idempotent request handling",
      "Guarded state transitions",
      "Manual review when provider data looks unsafe",
    ],
  },
  {
    title: "Observability",
    body:
      "Monitoring only helps when status, metrics, dashboards, and alert paths can be checked without hand-waving.",
    proofs: [
      "Prometheus targets and metrics",
      "Grafana dashboard provisioning",
      "Alert routing and repeatable local verification",
    ],
  },
  {
    title: "Mobile-client trust",
    body:
      "A mobile client should not treat every device state the same before a sensitive action or request-signing path.",
    proofs: [
      "Risk signals from device checks",
      "Allow / confirm / block decision path",
      "Local event trail for why a decision happened",
    ],
  },
];

const stackGroups = [
  {
    title: "Mobile",
    items: ["Kotlin", "Android", "Jetpack Compose", "Java", "Swift", "SwiftUI"],
  },
  {
    title: "Backend",
    items: [
      "Spring Boot",
      "FastAPI",
      "REST APIs",
      "WebSocket",
      "Kafka",
      "Oracle SQL",
    ],
  },
  {
    title: "Reliability and platform",
    items: [
      "Docker",
      "Kubernetes",
      "Jenkins",
      "GitHub Actions",
      "Prometheus",
      "Grafana",
      "Alertmanager",
      "Dynatrace",
      "ElasticSearch",
    ],
  },
  {
    title: "Security",
    items: [
      "Mobile security",
      "Application hardening",
      "Request signing",
      "Encrypted storage",
      "Root/emulator signal checks",
    ],
  },
];

const projectLinks = [
  {
    label: "PayFlow Reliability",
    href: "https://github.com/fattah247/payflow-reliability",
  },
  {
    label: "iYup",
    href: "https://github.com/fattah247/iYup",
  },
  {
    label: "TrustGate Android",
    href: "https://github.com/fattah247/trustgate-android",
  },
];

function ExternalArrow() {
  return <span aria-hidden="true"> {"->"}</span>;
}

function RepoShot({
  alt,
  caption,
  href,
  sizes,
  src,
  tone,
}: {
  alt: string;
  caption: string;
  href: string;
  sizes: string;
  src: string;
  tone: string;
}) {
  return (
    <a
      className="artifact group"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <div className={`artifact-frame ${tone}`}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top transition duration-150 group-hover:scale-[1.025] group-focus-visible:scale-[1.025]"
          sizes={sizes}
        />
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <p className="text-sm leading-6 text-[color:var(--muted)]">{caption}</p>
        <span className="open-link shrink-0">Open repo<ExternalArrow /></span>
      </div>
    </a>
  );
}

export default function Home() {
  return (
    <div className="pb-16">
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[rgba(246,241,232,0.9)] backdrop-blur">
        <div className="shell flex min-h-16 items-center justify-between gap-4">
          <a href="#top" className="text-sm font-semibold tracking-[0.16em] uppercase">
            Muhammad A. Fattah
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            <nav aria-label="Primary">
              <ul className="flex items-center gap-6 text-sm text-[color:var(--muted)]">
                {navLinks.map((item) => (
                  <li key={item.href}>
                    <a className="nav-link" href={item.href}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-4 text-sm text-[color:var(--muted)]">
              {heroLinks.map((item) => (
                <a
                  className="nav-link"
                  href={item.href}
                  key={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              ))}
              <a className="nav-link" href="mailto:fattahmuhammad17@gmail.com">
                Email
              </a>
            </div>
          </div>

          <a className="ghost-link lg:hidden" href="#contact">
            Contact
          </a>
        </div>
      </header>

      <main id="top" className="shell">
        <section className="rise grid gap-12 pb-10 pt-20 lg:grid-cols-[minmax(0,1.18fr)_minmax(16rem,0.82fr)] lg:items-end">
          <div className="max-w-4xl">
            <p className="section-kicker">Payment systems. Android. Reliability.</p>
            <h1 className="section-title mt-5">Muhammad A. Fattah</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[color:var(--muted)] sm:text-xl">
              I work on Android/payment systems and build public-safe labs around
              transaction reliability, observability, and mobile-client trust
              boundaries.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a className="action-link action-link-primary" href="#projects">
                View work
              </a>
              {heroLinks.map((item) => (
                <a
                  className="action-link"
                  href={item.href}
                  key={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                  <ExternalArrow />
                </a>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[color:var(--line)] pt-4 text-sm text-[color:var(--muted)]">
              <span className="mono-label">Email</span>
              <a className="underline-link" href="mailto:fattahmuhammad17@gmail.com">
                fattahmuhammad17@gmail.com
              </a>
              <CopyEmailButton email="fattahmuhammad17@gmail.com" />
            </div>
          </div>

          <div className="space-y-7 lg:pb-2">
            <div className="border-l-2 border-[color:var(--accent)] pl-5">
              <p className="tiny-label">Why this work sits together</p>
              <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">
                The projects are all about systems that need to explain a decision:
                why a transaction did not duplicate, why a dashboard can be trusted,
                or why a mobile client blocked a sensitive action.
              </p>
            </div>

            <div className="space-y-3 border-t border-[color:var(--line)] pt-5">
              <p className="tiny-label">Proof terms</p>
              <ul className="flex flex-wrap gap-2">
                {[
                  "idempotency replay",
                  "duplicate webhook",
                  "settlement batch",
                  "reconciliation mismatch",
                  "Grafana dashboard",
                  "risk gate",
                  "security event log",
                ].map((term) => (
                  <li className="mono-pill" key={term}>
                    {term}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="work" className="rise section-rule py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="section-kicker">Work Focus</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              The projects here are built around three problems I keep returning to.
            </h2>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <p className="lede max-w-2xl">
              The portfolio is small on purpose. Each repo is here to prove a
              different part of the same engineering shape.
            </p>

            <div className="space-y-6">
              {focusAreas.map((area, index) => (
                <article
                  className="grid gap-3 border-t border-[color:var(--line)] pt-5 sm:grid-cols-[6rem_minmax(0,1fr)]"
                  key={area.title}
                >
                  <p className="mono-label text-[color:var(--accent)]">0{index + 1}</p>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.03em]">{area.title}</h3>
                    <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                      {area.body}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                      {area.proofs.map((proof) => (
                        <li key={proof}>- {proof}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rise section-rule py-12 sm:py-16">
          <div className="max-w-4xl">
            <p className="section-kicker">Why These Projects Exist</p>
            <p className="mt-4 text-2xl leading-10 tracking-[-0.03em] text-[color:var(--ink)] sm:text-3xl">
              I wanted the repos to be less random and closer to the problems I
              keep running into: retries, stuck transaction states, dashboards that
              need to be trusted, and mobile clients that should not treat every
              device the same.
            </p>
          </div>
        </section>

        <section id="projects" className="rise section-rule py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="section-kicker">Selected Work</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Three projects, three different kinds of proof.
            </h2>
            <p className="mt-4 lede">
              These are public-safe labs, not copies of employer systems.
            </p>
          </div>

          <article className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-6">
              <div className="project-rule" style={{ "--project-accent": "#9a6b2f" } as React.CSSProperties}>
                <p className="mono-label text-[color:var(--accent)]">PAYFLOW RELIABILITY</p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
                  PayFlow Reliability
                </h3>
                <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                  Payment-like failure paths in Spring Boot.
                </p>
              </div>

              <p className="lede max-w-2xl">
                Retries, duplicate webhooks, settlement mismatches, and unclear
                state transitions are where payment-like systems get messy.
              </p>

              <div className="flow-strip">
                {["Create", "Webhook", "Settle", "Reconcile", "Review"].map((item) => (
                  <span className="flow-step" key={item}>
                    {item}
                  </span>
                ))}
              </div>

              <ul className="grid gap-3 text-sm leading-6 text-[color:var(--muted)] sm:grid-cols-2">
                <li>- idempotent payment creation</li>
                <li>- duplicate webhook handling</li>
                <li>- settlement and reconciliation mismatch</li>
                <li>- manual review, audit events, tests, and CI</li>
              </ul>

              <p className="mono-label text-[color:var(--muted)]">
                Spring Boot, Java, PostgreSQL, Docker, GitHub Actions
              </p>

              <details className="toggle-panel">
                <summary>Proof and tradeoff</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="tiny-label">What it proves</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                      <li>- Replayed requests return the same payment intent.</li>
                      <li>- Duplicate or late callbacks do not silently rewrite state.</li>
                      <li>- Audit events keep review paths explainable.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="tiny-label">Tradeoff</p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                      Local lab, not a payment processor. No real gateway, no cloud
                      deployment, and no production claim.
                    </p>
                  </div>
                </div>
              </details>
            </div>

            <div className="grid gap-5">
              <RepoShot
                src="/projects/payflow/duplicate-webhook.png"
                alt="Duplicate provider webhook ignored in PayFlow Reliability."
                caption="Duplicate webhook ignored before it can create a second effect."
                href="https://github.com/fattah247/payflow-reliability"
                sizes="(max-width: 1024px) 100vw, 40vw"
                tone="bg-[#171310]"
              />
              <RepoShot
                src="/projects/payflow/audit-trail.png"
                alt="Audit trail view from PayFlow Reliability."
                caption="Audit events keep state changes and operator decisions readable."
                href="https://github.com/fattah247/payflow-reliability"
                sizes="(max-width: 1024px) 100vw, 40vw"
                tone="bg-[#171310]"
              />
            </div>
          </article>

          <article className="mt-14 grid gap-8 border-t border-[color:var(--line)] pt-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
            <div className="space-y-6">
              <div className="project-rule" style={{ "--project-accent": "#3f5f46" } as React.CSSProperties}>
                <p className="mono-label text-[#3f5f46]">IYUP</p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">iYup</h3>
                <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                  Self-hosted uptime and latency monitoring.
                </p>
              </div>

              <p className="lede max-w-2xl">
                Monitoring is only useful when status, metrics, dashboards, and
                alerts can be verified locally.
              </p>

              <div className="status-row">
                {["checks", "metrics", "dashboard", "alerts"].map((item) => (
                  <span className="status-pill" key={item}>
                    {item}
                  </span>
                ))}
              </div>

              <p className="mono-label text-[color:var(--muted)]">
                Go, FastAPI, Prometheus, Grafana, Alertmanager, Docker Compose, Helm, GitHub Actions
              </p>

              <details className="toggle-panel">
                <summary>Proof and tradeoff</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="tiny-label">What it proves</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                      <li>- active health checks and local status surfaces</li>
                      <li>- Prometheus scraping and Grafana dashboarding</li>
                      <li>- alert path wiring and repeatable verification commands</li>
                    </ul>
                  </div>
                  <div>
                    <p className="tiny-label">Tradeoff</p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                      Helm is render-validated here, not cluster-validated. No tracing,
                      no log aggregation, and no incident tooling layer.
                    </p>
                  </div>
                </div>
              </details>
            </div>

            <div className="space-y-5">
              <RepoShot
                src="/projects/iyup/grafana-dashboard.png"
                alt="Grafana dashboard from iYup."
                caption="Grafana dashboard is provisioned from the repository."
                href="https://github.com/fattah247/iYup"
                sizes="(max-width: 1024px) 100vw, 40vw"
                tone="bg-[#111713]"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <RepoShot
                  src="/projects/iyup/prometheus-targets.png"
                  alt="Prometheus targets page from iYup."
                  caption="Real scrape targets stay visible."
                  href="https://github.com/fattah247/iYup"
                  sizes="(max-width: 1024px) 100vw, 20vw"
                  tone="bg-[#111713]"
                />
                <div className="note-panel">
                  <p className="tiny-label">Verification path</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                    <li>- Docker Compose stack starts locally</li>
                    <li>- status API returns target state and latency</li>
                    <li>- screenshots are taken from the running stack</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>

          <article className="mt-14 grid gap-8 border-t border-[color:var(--line)] pt-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-6">
              <div className="project-rule" style={{ "--project-accent": "#3e5545" } as React.CSSProperties}>
                <p className="mono-label text-[#3e5545]">TRUSTGATE ANDROID</p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
                  TrustGate Android
                </h3>
                <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                  Secure Android client behavior.
                </p>
              </div>

              <p className="lede max-w-2xl">
                A mobile client should not treat every device state the same before
                sensitive actions.
              </p>

              <div className="space-y-3">
                {[
                  ["Low", "allow"],
                  ["Medium", "confirm"],
                  ["High", "block"],
                ].map(([risk, action]) => (
                  <div
                    className="flex items-center justify-between border-b border-[color:var(--line)] py-2 text-sm"
                    key={risk}
                  >
                    <span className="mono-label">{risk}</span>
                    <span className="text-[color:var(--muted)]">{action}</span>
                  </div>
                ))}
              </div>

              <p className="mono-label text-[color:var(--muted)]">
                Kotlin, Android, Jetpack Compose, Jetpack Security, OkHttp, GitHub Actions
              </p>

              <details className="toggle-panel">
                <summary>Proof and tradeoff</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="tiny-label">What it proves</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                      <li>- device-risk signal handling and gating logic</li>
                      <li>- request-signing shape and encrypted local storage</li>
                      <li>- local security events, tests, and CI</li>
                    </ul>
                  </div>
                  <div>
                    <p className="tiny-label">Tradeoff</p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                      Client-side checks are signals, not proof. No live attestation
                      backend and no production key management claim.
                    </p>
                  </div>
                </div>
              </details>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <RepoShot
                src="/projects/trustgate/device-risk-details.png"
                alt="Device risk details screen from TrustGate Android."
                caption="Risk details stay visible instead of hidden behind a score."
                href="https://github.com/fattah247/trustgate-android"
                sizes="(max-width: 1024px) 100vw, 22vw"
                tone="bg-[#d8d2c8]"
              />
              <RepoShot
                src="/projects/trustgate/security-event-log.png"
                alt="Security event log screen from TrustGate Android."
                caption="Security events keep the trust decision inspectable."
                href="https://github.com/fattah247/trustgate-android"
                sizes="(max-width: 1024px) 100vw, 22vw"
                tone="bg-[#d8d2c8]"
              />
            </div>
          </article>
        </section>

        <section className="rise section-rule py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <p className="section-kicker">Work Snapshot</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Current role and day-to-day shape.
              </h2>
            </div>

            <div className="space-y-5">
              <p className="lede">
                I work mostly around Android and payment systems:
                merchant-facing payment flows, app-to-service integration,
                transaction status handling, release coordination, production
                fixes, and mobile security hardening. I also contribute to early
                iOS Merchant App work, including base implementation for order
                creation, phone-based payment flows, and merchant business
                features.
              </p>

              <div className="grid gap-4 border-l border-[color:var(--line)] pl-5">
                <div>
                  <p className="tiny-label">Android and merchant flows</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    Payment flows, app-to-service integration, transaction status
                    handling, and release coordination.
                  </p>
                </div>
                <div>
                  <p className="tiny-label">Production and hardening</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    Production fixes, mobile security hardening, and work that needs
                    to stay public-safe when described externally.
                  </p>
                </div>
                <div>
                  <p className="tiny-label">Early iOS support</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    Base implementation for order creation, phone-based payment flows,
                    and merchant business features.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="stack" className="rise section-rule py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="section-kicker">Stack</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Tools I keep reaching for.
            </h2>
          </div>

          <div className="mt-8">
            {stackGroups.map((group) => (
              <article
                className="grid gap-3 border-t border-[color:var(--line)] py-5 md:grid-cols-[14rem_minmax(0,1fr)]"
                key={group.title}
              >
                <p className="mono-label">{group.title}</p>
                <p className="text-base leading-7 text-[color:var(--muted)]">
                  {group.items.join(", ")}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="rise section-rule py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div>
              <p className="section-kicker">Contact</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Open to engineering conversations around payment systems, Android,
                backend reliability, observability, and platform work.
              </h2>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className="mono-label">Email</span>
                <a className="underline-link" href="mailto:fattahmuhammad17@gmail.com">
                  fattahmuhammad17@gmail.com
                </a>
                <CopyEmailButton email="fattahmuhammad17@gmail.com" />
              </div>

              <div className="grid gap-5 border-t border-[color:var(--line)] pt-5 sm:grid-cols-2">
                <div>
                  <p className="tiny-label">Profiles</p>
                  <ul className="mt-3 space-y-3 text-sm font-semibold">
                    <li>
                      <a
                        className="underline-link"
                        href="https://github.com/fattah247"
                        target="_blank"
                        rel="noreferrer"
                      >
                        GitHub profile<ExternalArrow />
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline-link"
                        href="https://www.linkedin.com/in/muhammad24fattah/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        LinkedIn<ExternalArrow />
                      </a>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="tiny-label">Project repos</p>
                  <ul className="mt-3 space-y-3 text-sm font-semibold">
                    {projectLinks.map((item) => (
                      <li key={item.href}>
                        <a
                          className="underline-link"
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.label}
                          <ExternalArrow />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--line)] py-8">
        <div className="shell flex flex-col gap-3 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Muhammad A. Fattah</p>
          <p>GitHub / LinkedIn / Email</p>
        </div>
      </footer>
    </div>
  );
}
