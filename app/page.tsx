import Image from "next/image";
import { CopyEmailButton } from "@/components/copy-email-button";
import { ParallaxBlock } from "@/components/parallax-block";
import { ScrollProgress } from "@/components/scroll-progress";
import { ScrollReveal } from "@/components/scroll-reveal";
import { AmbientMarks } from "@/components/ambient-marks";

const navLinks = [
  { label: "Work", href: "#work" },
  { label: "Projects", href: "#projects" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#contact" },
];

const profileLinks = [
  { label: "GitHub", href: "https://github.com/fattah247" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/muhammad24fattah/" },
];

const failureCases = [
  ["Duplicate payment callback", "PayFlow webhook idempotency"],
  ["Unclear transaction state", "PayFlow guarded state transitions"],
  ["Settlement mismatch", "PayFlow reconciliation review"],
  ["Service looks up but is slow", "iYup latency and dashboard checks"],
  ["Monitoring surface not trusted", "iYup local verification script"],
  ["Risky Android environment", "TrustGate device-risk signals"],
  ["Sensitive action on risky device", "TrustGate action gate"],
];

const stackGroups = [
  {
    title: "Mobile",
    items: "Kotlin, Android, Jetpack Compose, Java, Swift, SwiftUI",
  },
  {
    title: "Backend",
    items: "Spring Boot, FastAPI, REST APIs, WebSocket, Kafka, Oracle SQL",
  },
  {
    title: "Reliability & platform",
    items:
      "Docker, Kubernetes, Jenkins, GitHub Actions, Prometheus, Grafana, Alertmanager, Dynatrace, ElasticSearch",
  },
  {
    title: "Security",
    items:
      "Mobile security, application hardening, request signing, encrypted storage, root/emulator signal checks",
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
  return <span aria-hidden="true"> {"→"}</span>;
}

function RepoShot({
  alt,
  caption,
  href,
  sizes,
  src,
  tone,
  wide = false,
  tall = false,
}: {
  alt: string;
  caption: string;
  href: string;
  sizes: string;
  src: string;
  tone: string;
  wide?: boolean;
  tall?: boolean;
}) {
  return (
    <a className="artifact group" href={href} target="_blank" rel="noreferrer">
      <ParallaxBlock
        className={`artifact-frame ${tone} ${wide ? "artifact-frame-wide" : ""} ${tall ? "artifact-frame-tall" : ""}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top transition duration-200 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
          sizes={sizes}
        />
        <div className="artifact-overlay">Open repo →</div>
      </ParallaxBlock>
      <div className="mt-3 flex items-start justify-between gap-4">
        <p className="text-sm leading-6 text-[color:var(--muted)]">{caption}</p>
        <span className="open-link shrink-0">
          Repo
          <ExternalArrow />
        </span>
      </div>
    </a>
  );
}

export default function Home() {
  return (
    <div className="pb-16">
      {/* Scroll progress bar */}
      <div id="scroll-progress" aria-hidden="true" />
      <ScrollProgress />

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[rgba(248,249,247,0.92)] backdrop-blur">
        <div className="shell flex min-h-16 items-center justify-between gap-4">
          <a
            href="#top"
            className="text-[0.8rem] font-semibold tracking-[0.12em] uppercase text-[color:var(--text)]"
          >
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
              {profileLinks.map((item) => (
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
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-10 pt-20">
          <AmbientMarks />

          <ScrollReveal>
            <div className="max-w-5xl">
              <h1 className="hero-name">Muhammad A. Fattah</h1>
              <p className="hero-line mt-3">
                Payment systems. Android. Reliability.
              </p>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[color:var(--muted)] sm:text-xl">
                I work on Android payment systems and backend reliability:
                failed states, duplicate callbacks, service health,
                observability, and mobile-client trust.
              </p>
              <p className="mt-4 max-w-4xl text-base leading-7 text-[color:var(--body)]">
                These labs model the same problems I keep running into: unclear
                transaction states, weak visibility, and clients that trust too
                much.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a className="action-link action-link-primary" href="#projects">
                  View work
                </a>
                {profileLinks.map((item) => (
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
                <a
                  className="action-link"
                  href="mailto:fattahmuhammad17@gmail.com"
                >
                  Email
                </a>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--muted)]">
                <a
                  className="underline-link"
                  href="mailto:fattahmuhammad17@gmail.com"
                >
                  fattahmuhammad17@gmail.com
                </a>
                <CopyEmailButton email="fattahmuhammad17@gmail.com" />
              </div>

              <p
                className="mt-8 text-[0.72rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--muted)]"
                aria-hidden="true"
              >
                ↓ scroll
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* ── Thesis: three failure cases ───────────────────── */}
        <ScrollReveal>
          <section className="major-rule py-12 sm:py-16">
            <div className="max-w-4xl">
              <h2 className="thesis-heading">
                I build around three failure cases:
              </h2>
              <ol className="thesis-list" aria-label="Three failure cases">
                <li className="thesis-item">
                  <span className="thesis-item-num">01</span>
                  Payments that fail without clear state.
                </li>
                <li className="thesis-item">
                  <span className="thesis-item-num">02</span>
                  Dashboards that show numbers but not causes.
                </li>
                <li className="thesis-item">
                  <span className="thesis-item-num">03</span>
                  Android clients that trust unsafe devices.
                </li>
              </ol>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Work focus ────────────────────────────────────── */}
        <ScrollReveal stagger>
          <section id="work" className="major-rule py-12 sm:py-16">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <div className="max-w-2xl">
                <h2 className="section-heading">Work focus</h2>
                <p className="mt-5 lede">
                  The same failures kept appearing in different forms: a payment
                  that did not clearly succeed or fail, a dashboard that showed
                  status but not cause, a mobile client trusted too easily.
                </p>
              </div>

              <div className="space-y-8">
                {[
                  {
                    num: "01",
                    title: "Transaction reliability",
                    body: 'Not just "did it work?" but "what state is it in, who knows, and what happens next?"',
                  },
                  {
                    num: "02",
                    title: "Observability",
                    body: "Dashboards are useless if they cannot explain failure.",
                  },
                  {
                    num: "03",
                    title: "Mobile-client trust",
                    body: "A payment client should not treat every device as equally safe.",
                  },
                ].map((note) => (
                  <article className="reveal-child" key={note.num}>
                    <span className="note-number">{note.num}</span>
                    <h3 className="note-title">{note.title}</h3>
                    <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                      {note.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Why these projects exist ──────────────────────── */}
        <ScrollReveal>
          <section className="py-12 sm:py-16">
            <div className="max-w-4xl">
              <p className="text-xl leading-9 tracking-[-0.02em] text-[color:var(--body)] sm:text-2xl sm:leading-10">
                I did not want three random portfolio repos. I wanted one
                backend project, one observability project, and one Android
                security project that orbit the same problem:
              </p>
              <blockquote className="field-note-quote">
                transactions should be reliable,
                <br />
                visible,
                <br />
                and harder to abuse.
              </blockquote>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Failure cases table ───────────────────────────── */}
        <ScrollReveal>
          <section className="major-rule pb-12 sm:pb-16 pt-12 sm:pt-16">
            <div className="max-w-5xl">
              <h2 className="section-heading">Failure cases I care about</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[color:var(--muted)]">
                One reason these repos belong together: they model different
                failure surfaces from the same kind of system.
              </p>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Failure case</th>
                    <th>Portfolio proof</th>
                  </tr>
                </thead>
                <tbody>
                  {failureCases.map(([failure, model]) => (
                    <tr key={failure}>
                      <td>{failure}</td>
                      <td>{model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Projects ──────────────────────────────────────── */}
        <section id="projects" className="major-rule py-12 sm:py-16">
          <ScrollReveal>
            <div className="max-w-3xl">
              <h2 className="section-heading">Work</h2>
            </div>
          </ScrollReveal>

          {/* PayFlow Reliability */}
          <ScrollReveal>
            <article className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-6">
                <div className="project-marker project-marker-blue">
                  <h3 className="project-title">PayFlow Reliability</h3>
                  <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                    Payment-like failure paths in Spring Boot.
                  </p>
                </div>

                <p className="lede max-w-2xl">
                  A Spring Boot reliability lab for payment-like flows: retries,
                  duplicate callbacks, settlement mismatch, webhook failure, and
                  state transitions.
                </p>

                <ul className="proof-list">
                  {[
                    "idempotency key handling",
                    "duplicate callback handling",
                    "guarded state transitions",
                    "settlement mismatch",
                    "manual review",
                    "audit events",
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <div className="flow-strip">
                  {[
                    { label: "Request", warn: false },
                    { label: "Intent", warn: false },
                    { label: "Webhook", warn: true },
                    { label: "Settlement", warn: true },
                    { label: "Reconciliation", warn: true },
                    { label: "Review", warn: false },
                    { label: "Audit", warn: false },
                  ].map((item) => (
                    <span
                      className={`flow-step ${item.warn ? "flow-step-warn" : ""}`}
                      key={item.label}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>

                <p className="project-tech">
                  Spring Boot · Java · PostgreSQL · Docker · GitHub Actions
                </p>

                <details className="toggle-panel">
                  <summary>Evidence and limits</summary>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <h4 className="detail-heading">Evidence</h4>
                      <ul className="detail-list">
                        <li>
                          Replayed requests return the same payment intent.
                        </li>
                        <li>
                          Duplicate or late callbacks do not silently rewrite
                          state.
                        </li>
                        <li>
                          Audit events keep review paths explainable.
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="detail-heading">Limit</h4>
                      <p className="detail-copy">
                        Local lab, not a payment processor.
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              <div className="space-y-5">
                <RepoShot
                  src="/projects/payflow/audit-trail.png"
                  alt="Audit trail output from PayFlow Reliability showing state transitions."
                  caption="Audit trail: state transitions and operator-relevant events stay readable."
                  href="https://github.com/fattah247/payflow-reliability"
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  tone="bg-[#0e1621]"
                  wide
                />
                <RepoShot
                  src="/projects/payflow/duplicate-webhook.png"
                  alt="Duplicate provider webhook handled and ignored in PayFlow Reliability."
                  caption="Duplicate callback handling is visible in the response, not implied."
                  href="https://github.com/fattah247/payflow-reliability"
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  tone="bg-[#0e1621]"
                />
              </div>
            </article>
          </ScrollReveal>

          {/* iYup */}
          <ScrollReveal>
            <article className="project-block">
              <div className="space-y-6">
                <div className="project-marker project-marker-green">
                  <h3 className="project-title">iYup</h3>
                  <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                    Self-hosted uptime and latency monitoring.
                  </p>
                </div>

                <p className="lede max-w-2xl">
                  iYup is a small observability monitor for backend services:
                  health status, latency, metrics, alert states, and service
                  visibility.
                </p>

                <div className="signal-table-wrap">
                  <table className="signal-table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Surface</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Health checks</td>
                        <td>Status API</td>
                      </tr>
                      <tr>
                        <td>Latency</td>
                        <td>Prometheus / Grafana</td>
                      </tr>
                      <tr>
                        <td>Target state</td>
                        <td>API / dashboard</td>
                      </tr>
                      <tr>
                        <td>Alerts</td>
                        <td>Alertmanager</td>
                      </tr>
                      <tr>
                        <td>Validation</td>
                        <td>local script / CI</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="project-tech">
                  Go · FastAPI · Prometheus · Grafana · Alertmanager · Docker
                  Compose · Helm · GitHub Actions
                </p>

                <details className="toggle-panel">
                  <summary>Evidence and limits</summary>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <h4 className="detail-heading">Evidence</h4>
                      <ul className="detail-list">
                        <li>Active health checks</li>
                        <li>Prometheus scraping</li>
                        <li>Grafana dashboarding</li>
                        <li>Alertmanager wiring</li>
                        <li>Docker Compose operation</li>
                        <li>Helm validation</li>
                        <li>Repeatable verification</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="detail-heading">Limit</h4>
                      <p className="detail-copy">
                        Helm is render-validated here, not cluster-validated.
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              <div className="space-y-5">
                <RepoShot
                  src="/projects/iyup/grafana-dashboard.png"
                  alt="Grafana dashboard from iYup showing service health and latency metrics."
                  caption="Grafana is the visual anchor: target health, metrics, and service visibility in one surface."
                  href="https://github.com/fattah247/iYup"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  tone="bg-[#101412]"
                  wide
                />
                <RepoShot
                  src="/projects/iyup/prometheus-targets.png"
                  alt="Prometheus targets page from iYup showing scrape state for monitored services."
                  caption="Prometheus targets: scrape state is directly inspectable, not inferred."
                  href="https://github.com/fattah247/iYup"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  tone="bg-[#101412]"
                  wide
                />
              </div>
            </article>
          </ScrollReveal>

          {/* TrustGate Android */}
          <ScrollReveal>
            <article className="project-block">
              <div className="space-y-6">
                <div className="project-marker project-marker-amber">
                  <h3 className="project-title">TrustGate Android</h3>
                  <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                    Android client trust lab.
                  </p>
                </div>

                <p className="lede max-w-2xl">
                  A mobile trust lab for deciding when an Android payment client
                  should allow, warn, or block sensitive behavior.
                </p>

                <div className="signal-table-wrap">
                  <table className="signal-table">
                    <thead>
                      <tr>
                        <th>Condition</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Low risk</td>
                        <td>allow</td>
                      </tr>
                      <tr>
                        <td>Medium risk</td>
                        <td>require confirmation</td>
                      </tr>
                      <tr>
                        <td>High risk</td>
                        <td>block</td>
                      </tr>
                      <tr>
                        <td>Request signing</td>
                        <td>attach timestamp, nonce, signature</td>
                      </tr>
                      <tr>
                        <td>Secure storage</td>
                        <td>store mock token / risk state</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="project-tech">
                  Kotlin · Android · Jetpack Compose · Jetpack Security · OkHttp
                  · GitHub Actions
                </p>

                <details className="toggle-panel">
                  <summary>Evidence and limits</summary>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <h4 className="detail-heading">Evidence</h4>
                      <ul className="detail-list">
                        <li>Root / emulator signal handling</li>
                        <li>Sensitive action gating</li>
                        <li>HMAC request signing</li>
                        <li>Encrypted local storage</li>
                        <li>Local security event trail</li>
                        <li>Android tests and CI</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="detail-heading">Limit</h4>
                      <p className="detail-copy">
                        Client checks are signals, not proof. No live
                        attestation backend.
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <RepoShot
                    src="/projects/trustgate/device-risk-details.png"
                    alt="Device risk details screen from TrustGate Android showing risk signals."
                    caption="Low-risk state: risk signals stay visible instead of hidden behind a single score."
                    href="https://github.com/fattah247/trustgate-android"
                    sizes="(max-width: 1024px) 100vw, 24vw"
                    tone="bg-[#d6d0c7]"
                    tall
                  />
                  <RepoShot
                    src="/projects/trustgate/security-event-log.png"
                    alt="Security event log screen from TrustGate Android."
                    caption="Security event log: blocked or gated behavior leaves an inspectable trail."
                    href="https://github.com/fattah247/trustgate-android"
                    sizes="(max-width: 1024px) 100vw, 24vw"
                    tone="bg-[#d6d0c7]"
                    tall
                  />
                </div>
              </div>
            </article>
          </ScrollReveal>
        </section>

        {/* ── Work snapshot ─────────────────────────────────── */}
        <ScrollReveal>
          <section className="major-rule py-12 sm:py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <div>
                <h2 className="section-heading">Current work</h2>
              </div>

              <div className="space-y-6">
                <p className="lede">
                  I work mostly around Android and payment systems:
                  merchant-facing payment flows, app-to-service integration,
                  transaction status handling, release coordination, production
                  fixes, and mobile security hardening.
                </p>
                <p className="lede">
                  I also contribute to early iOS Merchant App work, including
                  base implementation for order creation, phone-based payment
                  flows, and merchant business features.
                </p>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Stack ─────────────────────────────────────────── */}
        <ScrollReveal stagger>
          <section id="stack" className="major-rule py-12 sm:py-16">
            <div className="max-w-3xl">
              <h2 className="section-heading">Stack</h2>
            </div>

            <div className="mt-8">
              {stackGroups.map((group) => (
                <article className="stack-row reveal-child" key={group.title}>
                  <p className="stack-label">{group.title}</p>
                  <p className="text-base leading-7 text-[color:var(--muted)]">
                    {group.items}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* ── Contact ───────────────────────────────────────── */}
        <ScrollReveal>
          <section id="contact" className="major-rule py-12 sm:py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <div>
                <h2 className="section-heading">Contact</h2>
                <p className="mt-4 lede">
                  Engineering conversations around payment systems, Android,
                  backend reliability, observability, and platform work are
                  welcome.
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <a
                    className="underline-link"
                    href="mailto:fattahmuhammad17@gmail.com"
                  >
                    Email
                  </a>
                  <a
                    className="underline-link"
                    href="https://github.com/fattah247"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                    <ExternalArrow />
                  </a>
                  <a
                    className="underline-link"
                    href="https://www.linkedin.com/in/muhammad24fattah/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                    <ExternalArrow />
                  </a>
                  <CopyEmailButton email="fattahmuhammad17@gmail.com" />
                </div>

                <div className="project-links-grid">
                  {projectLinks.map((item) => (
                    <a
                      className="project-link-row"
                      href={item.href}
                      key={item.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{item.label}</span>
                      <ExternalArrow />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="border-t border-[color:var(--line)] py-8">
        <div className="shell flex flex-col gap-3 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Muhammad A. Fattah</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              className="underline-link text-[color:var(--muted)]"
              href="https://github.com/fattah247"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="underline-link text-[color:var(--muted)]"
              href="https://www.linkedin.com/in/muhammad24fattah/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a
              className="underline-link text-[color:var(--muted)]"
              href="mailto:fattahmuhammad17@gmail.com"
            >
              Email
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
