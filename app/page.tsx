import Image from "next/image";
import { CopyEmailButton } from "@/components/copy-email-button";

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

const workNotes = [
  {
    title: "01 Transaction reliability",
    body: "Not just “did it work?” but “what state is it in, who knows, and what happens next?”",
  },
  {
    title: "02 Observability",
    body: "Dashboards are useless if they cannot explain failure.",
  },
  {
    title: "03 Mobile-client trust",
    body: "A payment client should not treat every device as equally safe.",
  },
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
    title: "Reliability and platform",
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
  return <span aria-hidden="true"> {"->"}</span>;
}

function RepoShot({
  alt,
  caption,
  href,
  sizes,
  src,
  tone,
  wide = false,
}: {
  alt: string;
  caption: string;
  href: string;
  sizes: string;
  src: string;
  tone: string;
  wide?: boolean;
}) {
  return (
    <a className="artifact group" href={href} target="_blank" rel="noreferrer">
      <div className={`artifact-frame ${tone} ${wide ? "artifact-frame-wide" : ""}`}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top transition duration-150 group-hover:scale-[1.02] group-focus-visible:scale-[1.02]"
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
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[rgba(243,240,232,0.92)] backdrop-blur">
        <div className="shell flex min-h-16 items-center justify-between gap-4">
          <a href="#top" className="text-sm font-semibold tracking-[0.12em] uppercase">
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
        <section className="rise pb-10 pt-20">
          <div className="max-w-5xl">
            <h1 className="hero-name">Muhammad A. Fattah</h1>
            <p className="hero-line mt-3">Payment systems. Android. Reliability.</p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[color:var(--muted)] sm:text-xl">
              I work on Android/payment systems and build public-safe labs around
              transaction reliability, observability, and mobile-client trust boundaries.
            </p>
            <p className="mt-5 max-w-4xl text-base leading-7 text-[color:var(--muted)]">
              The projects below focus on the boring parts that keep software useful:
              failed states, duplicate callbacks, trusted dashboards, and mobile
              clients that should not treat every device the same.
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
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-[color:var(--muted)]">
              <a className="underline-link" href="mailto:fattahmuhammad17@gmail.com">
                fattahmuhammad17@gmail.com
              </a>
              <CopyEmailButton email="fattahmuhammad17@gmail.com" />
            </div>

            <ul className="mt-7 flex flex-wrap gap-2">
              {[
                "Android payment systems",
                "backend reliability",
                "observability dashboards",
              ].map((item) => (
                <li className="mono-pill mono-pill-blue" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="work" className="rise major-rule py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="max-w-2xl">
              <p className="section-tag">FOCUS</p>
              <h2 className="mt-4 section-heading">Work focus</h2>
              <p className="mt-5 lede">
                The same failures kept appearing in different forms: a payment that
                did not clearly succeed or fail, a dashboard that showed status but
                not cause, a mobile client trusted too easily.
              </p>
            </div>

            <div className="space-y-8">
              {workNotes.map((note) => (
                <article className="numbered-note" key={note.title}>
                  <h3 className="text-xl font-semibold tracking-[-0.02em]">{note.title}</h3>
                  <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                    {note.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rise py-12 sm:py-16">
          <div className="max-w-4xl">
            <h2 className="section-heading">Why these projects exist</h2>
            <div className="mt-6 space-y-4 text-xl leading-9 tracking-[-0.02em] text-[color:var(--text)] sm:text-2xl sm:leading-10">
              <p>I did not want three random portfolio repos.</p>
              <p>
                I wanted one backend project, one observability project, and one
                Android security project that orbit the same problem:
              </p>
              <p className="field-note-quote">
                transactions should be reliable,
                <br />
                visible,
                <br />
                and harder to abuse.
              </p>
            </div>
          </div>
        </section>

        <section className="rise pb-12 sm:pb-16">
          <div className="artifact-ledger">
            <div className="max-w-2xl">
              <h2 className="section-heading">Failure cases I care about</h2>
              <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">
                One reason these repos belong together is that they model different
                failure surfaces from the same operating view.
              </p>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Failure case</th>
                    <th>What the portfolio uses to model it</th>
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
          </div>
        </section>

        <section id="projects" className="rise major-rule py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="section-tag">PROJECTS</p>
            <h2 className="mt-4 section-heading">Selected work</h2>
            <p className="mt-4 lede">
              These are public-safe labs, not copies of employer systems.
            </p>
          </div>

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
                  "idempotency",
                  "duplicate callbacks",
                  "settlement mismatch",
                  "manual review",
                  "audit events",
                  "tests / CI",
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className="flow-strip flow-strip-blue">
                {[
                  "Request",
                  "Intent",
                  "Webhook",
                  "Settlement",
                  "Reconciliation",
                  "Review",
                  "Audit",
                ].map((item) => (
                  <span className="flow-step" key={item}>
                    {item}
                  </span>
                ))}
              </div>

              <p className="project-tech">
                Spring Boot, Java, PostgreSQL, Docker, GitHub Actions
              </p>

              <details className="toggle-panel">
                <summary>Proof and tradeoff</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h4 className="detail-heading">What it proves</h4>
                    <ul className="detail-list">
                      <li>Replayed requests return the same payment intent.</li>
                      <li>Duplicate or late callbacks do not silently rewrite state.</li>
                      <li>Audit events keep review paths explainable.</li>
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
                alt="Audit trail view from PayFlow Reliability."
                caption="Audit trail: state transitions and operator-relevant events stay readable."
                href="https://github.com/fattah247/payflow-reliability"
                sizes="(max-width: 1024px) 100vw, 52vw"
                tone="bg-[#101317]"
                wide
              />
              <RepoShot
                src="/projects/payflow/duplicate-webhook.png"
                alt="Duplicate provider webhook ignored in PayFlow Reliability."
                caption="Duplicate callback handling is visible instead of implied."
                href="https://github.com/fattah247/payflow-reliability"
                sizes="(max-width: 1024px) 100vw, 52vw"
                tone="bg-[#101317]"
              />
            </div>
          </article>

          <article className="project-block">
            <div className="space-y-6">
              <div className="project-marker project-marker-green">
                <h3 className="project-title">iYup</h3>
                <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                  Self-hosted uptime and latency monitoring.
                </p>
              </div>

              <p className="lede max-w-2xl">
                iYup is a small observability monitor for backend services: health
                status, basic metrics, alert states, and service visibility.
              </p>

              <p className="project-tech">
                Go, FastAPI, Prometheus, Grafana, Alertmanager, Docker Compose, Helm,
                GitHub Actions
              </p>

              <details className="toggle-panel">
                <summary>Proof and tradeoff</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h4 className="detail-heading">What it proves</h4>
                    <ul className="detail-list">
                      <li>active health checks</li>
                      <li>Prometheus scraping</li>
                      <li>Grafana dashboarding</li>
                      <li>Alertmanager wiring</li>
                      <li>Docker Compose operation</li>
                      <li>Helm validation</li>
                      <li>repeatable verification</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="detail-heading">Tradeoff</h4>
                    <p className="detail-copy">
                      Helm is render-validated here, not cluster-validated.
                    </p>
                  </div>
                </div>
              </details>
            </div>

            <div className="space-y-6">
              <RepoShot
                src="/projects/iyup/grafana-dashboard.png"
                alt="Grafana dashboard from iYup."
                caption="Grafana is the visual anchor here: target health, metrics, and service visibility in one surface."
                href="https://github.com/fattah247/iYup"
                sizes="(max-width: 1024px) 100vw, 58vw"
                tone="bg-[#101412]"
                wide
              />

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
            </div>
          </article>

          <article className="project-block">
            <div className="space-y-6">
              <div className="project-marker project-marker-amber">
                <h3 className="project-title">TrustGate Android</h3>
                <p className="mt-2 text-base leading-7 text-[color:var(--muted)]">
                  Android client trust lab.
                </p>
              </div>

              <p className="lede max-w-2xl">
                A mobile trust lab for deciding when an Android payment client should
                allow, warn, or block sensitive behavior.
              </p>

              <p className="project-tech">
                Kotlin, Android, Jetpack Compose, Jetpack Security, OkHttp, GitHub Actions
              </p>

              <details className="toggle-panel">
                <summary>Proof and tradeoff</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h4 className="detail-heading">What it proves</h4>
                    <ul className="detail-list">
                      <li>root/emulator signals</li>
                      <li>risk gate</li>
                      <li>HMAC request signing</li>
                      <li>encrypted storage</li>
                      <li>security events</li>
                      <li>Android CI</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="detail-heading">Tradeoff</h4>
                    <p className="detail-copy">
                      Client checks are signals, not proof. No live attestation backend.
                    </p>
                  </div>
                </div>
              </details>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <RepoShot
                  src="/projects/trustgate/device-risk-details.png"
                  alt="Device risk details screen from TrustGate Android."
                  caption="Low-risk action: risk details stay visible instead of hidden behind a score."
                  href="https://github.com/fattah247/trustgate-android"
                  sizes="(max-width: 1024px) 100vw, 24vw"
                  tone="bg-[#d6d0c7]"
                />
                <RepoShot
                  src="/projects/trustgate/security-event-log.png"
                  alt="Security event log screen from TrustGate Android."
                  caption="Security event log: blocked or gated behavior leaves an inspectable trail."
                  href="https://github.com/fattah247/trustgate-android"
                  sizes="(max-width: 1024px) 100vw, 24vw"
                  tone="bg-[#d6d0c7]"
                />
              </div>

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
                      <td>store mock token/risk state</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>

        <section className="rise major-rule py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div>
              <p className="section-tag">WORK</p>
              <h2 className="mt-4 section-heading">Work snapshot</h2>
            </div>

            <div className="space-y-6">
              <p className="lede">
                I work mostly around Android and payment systems: merchant-facing
                payment flows, app-to-service integration, transaction status handling,
                release coordination, production fixes, and mobile security hardening.
              </p>
              <p className="lede">
                I also contribute to early iOS Merchant App work, including base
                implementation for order creation, phone-based payment flows, and
                merchant business features.
              </p>
            </div>
          </div>
        </section>

        <section id="stack" className="rise major-rule py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="section-tag">STACK</p>
            <h2 className="mt-4 section-heading">Stack</h2>
          </div>

          <div className="mt-8">
            {stackGroups.map((group) => (
              <article className="stack-row" key={group.title}>
                <p className="stack-label">{group.title}</p>
                <p className="text-base leading-7 text-[color:var(--muted)]">{group.items}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="rise major-rule py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div>
              <p className="section-tag">CONTACT</p>
              <h2 className="mt-4 section-heading">Contact</h2>
              <p className="mt-4 lede">
                Engineering conversations around payment systems, Android, backend
                reliability, observability, and platform work are welcome.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <a className="underline-link" href="mailto:fattahmuhammad17@gmail.com">
                  Email
                </a>
                <a
                  className="underline-link"
                  href="https://github.com/fattah247"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub<ExternalArrow />
                </a>
                <a
                  className="underline-link"
                  href="https://www.linkedin.com/in/muhammad24fattah/"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn<ExternalArrow />
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
