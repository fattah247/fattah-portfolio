import Image from "next/image";
import { CopyEmailButton } from "@/components/copy-email-button";
import { NavLinks } from "@/components/nav-links";
import { ScrollProgress } from "@/components/scroll-progress";
import { ScrollReveal } from "@/components/scroll-reveal";

const navLinks = [
  { label: "Focus", href: "#focus" },
  { label: "Map", href: "#map" },
  { label: "Labs", href: "#labs" },
  { label: "Production", href: "#production" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#contact" },
];

const profileLinks = [
  { label: "GitHub", href: "https://github.com/fattah247" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/muhammad24fattah/" },
];

const failureCases = [
  ["Duplicate payment callback", "PayFlow Reliability", "lab-payflow"],
  ["Unclear transaction state", "PayFlow Reliability", "lab-payflow"],
  ["Settlement mismatch", "PayFlow Reliability", "lab-payflow"],
  ["Service looks healthy but is slow", "iYup", "lab-iyup"],
  ["Dashboard shows status but not cause", "iYup", "lab-iyup"],
  ["Risky Android environment", "TrustGate Android", "lab-trustgate"],
  ["Sensitive action on risky device", "TrustGate Android", "lab-trustgate"],
] as const;

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
      "Mobile security, application hardening, request signing, encrypted storage, root and emulator signal checks",
  },
] as const;

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
] as const;

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
      <div
        className={`artifact-frame ${tone} ${wide ? "artifact-frame-wide" : ""} ${tall ? "artifact-frame-tall" : ""}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top transition duration-200 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
          sizes={sizes}
          unoptimized
        />
        <div className="artifact-overlay">Open repo</div>
      </div>
      <div className="artifact-caption">
        <p className="artifact-caption-text">{caption}</p>
        <span className="open-link">Repo</span>
      </div>
    </a>
  );
}

export default function Home() {
  return (
    <div className="pb-16">
      <div id="scroll-progress" aria-hidden="true" />
      <ScrollProgress />

      <header className="site-header">
        <div className="shell flex min-h-16 items-center justify-between gap-4">
          <a href="#top" className="site-title">
            Muhammad A. Fattah
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            <nav aria-label="Primary">
              <NavLinks links={navLinks} />
            </nav>

            <div className="header-links">
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
        <section className="section-block hero-section">
          <ScrollReveal>
            <div className="hero-grid">
              <div className="max-w-5xl">
                <p className="section-kicker">Payment reliability field dossier</p>
                <h1 className="hero-name">Muhammad A. Fattah</h1>
                <p className="hero-line">Payment systems. Android. Reliability.</p>
                <p className="hero-body">
                  I work on Android payment systems and build public-safe labs
                  around transaction reliability, observability, and
                  mobile-client trust boundaries.
                </p>
                <p className="hero-support">
                  The through-line is simple: unclear state, weak visibility,
                  and risky client behavior are where payment systems become
                  expensive to operate.
                </p>

                <div className="hero-actions">
                  <a className="action-link action-link-primary" href="#labs">
                    View labs
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
                    </a>
                  ))}
                  <a
                    className="action-link"
                    href="mailto:fattahmuhammad17@gmail.com"
                  >
                    Email
                  </a>
                </div>

                <div className="hero-email-row">
                  <a
                    className="underline-link"
                    href="mailto:fattahmuhammad17@gmail.com"
                  >
                    fattahmuhammad17@gmail.com
                  </a>
                  <CopyEmailButton email="fattahmuhammad17@gmail.com" />
                </div>
              </div>

              <div className="hero-cues">
                <span>Android payment flows</span>
                <span>Backend transaction state</span>
                <span>Observability surfaces</span>
                <span>Mobile-client trust</span>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <ScrollReveal>
          <section className="section-block section-block-tight">
            <div className="max-w-4xl">
              <p className="section-kicker">Failure model</p>
              <h2 className="thesis-heading">
                I build around three failure cases:
              </h2>
              <ol className="thesis-list" aria-label="Three failure cases">
                <li className="thesis-item">
                  <span className="thesis-num thesis-num-payflow">01</span>
                  Payments that fail without clear state.
                </li>
                <li className="thesis-item">
                  <span className="thesis-num thesis-num-iyup">02</span>
                  Dashboards that show numbers but not causes.
                </li>
                <li className="thesis-item">
                  <span className="thesis-num thesis-num-trustgate">03</span>
                  Android clients that trust unsafe devices.
                </li>
              </ol>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal stagger>
          <section id="focus" className="section-block">
            <div className="section-head">
              <div className="max-w-2xl">
                <p className="section-kicker">Operating focus</p>
                <h2 className="section-heading">What I keep trying to make harder to break</h2>
                <p className="lede">
                  The same failures kept appearing in different forms: a
                  payment that did not clearly succeed or fail, a dashboard
                  that showed status but not cause, and a mobile client that
                  trusted too easily.
                </p>
              </div>
            </div>

            <div className="focus-grid">
              {[
                {
                  num: "01",
                  title: "Transaction reliability",
                  body: "Not just whether a payment worked, but what state it is in, who can inspect it, and what happens next when a callback arrives twice.",
                },
                {
                  num: "02",
                  title: "Observability that explains failure",
                  body: "A dashboard is only useful if it exposes cause, threshold, and target condition instead of stopping at green status.",
                },
                {
                  num: "03",
                  title: "Mobile-client trust boundaries",
                  body: "A payment client should treat device risk as an operating condition, not as an afterthought hidden behind a single score.",
                },
              ].map((note) => (
                <article className="focus-card reveal-child" key={note.num}>
                  <span className="focus-num">{note.num}</span>
                  <h3 className="focus-title">{note.title}</h3>
                  <p className="focus-copy">{note.body}</p>
                </article>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal>
          <section className="section-block section-block-tight">
            <div className="max-w-4xl">
              <p className="section-kicker">Project logic</p>
              <p className="statement-copy">
                I did not want three unrelated repos. I wanted one backend
                reliability lab, one observability lab, and one Android trust
                lab that orbit the same operating problem:
              </p>
              <blockquote className="field-note-quote">
                transaction systems should stay explainable under failure,
                visible under pressure, and harder to abuse at the client edge.
              </blockquote>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal>
          <section id="map" className="section-block evidence-band">
            <div className="max-w-5xl">
              <p className="section-kicker">Failure map</p>
              <h2 className="section-heading">Where each lab proves its value</h2>
              <p className="lede max-w-3xl">
                The repos belong together because they describe adjacent failure
                surfaces from the same kind of system.
              </p>
            </div>

            <div className="table-wrap">
              <table className="failure-table">
                <thead>
                  <tr>
                    <th>Failure surface</th>
                    <th>Proof source</th>
                  </tr>
                </thead>
                <tbody>
                  {failureCases.map(([surface, lab, colorClass]) => (
                    <tr key={surface}>
                      <td>{surface}</td>
                      <td className={colorClass}>{lab}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </ScrollReveal>

        <section id="labs" className="section-block">
          <ScrollReveal>
            <div className="max-w-3xl">
              <p className="section-kicker">Selected labs</p>
              <h2 className="section-heading">Three proof-heavy projects</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <article className="project-block project-block-first">
              <div className="project-copy-col">
                <div className="project-marker project-marker-payflow">
                  <p className="project-label">Backend payment reliability lab</p>
                  <h3 className="project-title">PayFlow Reliability</h3>
                  <p className="project-subtitle">
                    A Spring Boot lab for payment-like flows: idempotency,
                    duplicate callbacks, settlement mismatch, webhook failure,
                    and guarded state transitions.
                  </p>
                </div>

                <div className="project-module">
                  <p className="module-label">State transition path</p>
                  <div className="flow-strip">
                    {[
                      { label: "Request", warn: false },
                      { label: "Intent", warn: false },
                      { label: "Webhook", warn: true },
                      { label: "Settlement", warn: true },
                      { label: "Reconcile", warn: true },
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
                </div>

                <div className="project-module">
                  <p className="module-label">Concrete proof</p>
                  <ul className="proof-list">
                    {[
                      "idempotency key handling",
                      "duplicate callback handling",
                      "guarded state transitions",
                      "settlement mismatch review",
                      "manual review path",
                      "audit events",
                      "tests and CI",
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <p className="project-tech">
                  Spring Boot · Java · PostgreSQL · Docker · GitHub Actions
                </p>

                <div className="limit-box">
                  <h4 className="limit-heading">Constraint</h4>
                  <p className="limit-copy">
                    Local lab, not a payment processor.
                  </p>
                </div>

                <a
                  className="repo-text-link"
                  href="https://github.com/fattah247/payflow-reliability"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                </a>
              </div>

              <div className="project-proof-col">
                <div>
                  <RepoShot
                    src="/projects/payflow/audit-trail.png"
                    alt="Audit trail output from PayFlow Reliability showing state transitions."
                    caption="Audit trail keeps payment state transitions readable for operators instead of burying them in implied behavior."
                    href="https://github.com/fattah247/payflow-reliability"
                    sizes="(max-width: 1024px) 100vw, 54vw"
                    tone="bg-[#0e1621]"
                    wide
                  />
                  <ul className="evidence-note-list">
                    <li>Audit events stay visible at each checkpoint.</li>
                    <li>Failure handling preserves a reviewable state path.</li>
                  </ul>
                </div>

                <div>
                  <RepoShot
                    src="/projects/payflow/duplicate-webhook.png"
                    alt="Duplicate provider webhook handled and ignored in PayFlow Reliability."
                    caption="Duplicate callback handling is explicit in the output, not hidden behind an assumption that retries are harmless."
                    href="https://github.com/fattah247/payflow-reliability"
                    sizes="(max-width: 1024px) 100vw, 54vw"
                    tone="bg-[#0e1621]"
                    wide
                  />
                  <ul className="evidence-note-list">
                    <li>Replay protection shows up as behavior, not only as code.</li>
                    <li>Mismatch handling is surfaced before silent state drift.</li>
                  </ul>
                </div>
              </div>
            </article>
          </ScrollReveal>

          <ScrollReveal>
            <article className="project-block">
              <div className="project-copy-col">
                <div className="project-marker project-marker-iyup">
                  <p className="project-label">Observability and monitoring lab</p>
                  <h3 className="project-title">iYup</h3>
                  <p className="project-subtitle">
                    A self-hosted monitor for service health, latency, metrics,
                    alert state, and verification of what the dashboard is
                    actually claiming.
                  </p>
                </div>

                <div className="project-module">
                  <p className="module-label">Signal surfaces</p>
                  <table className="signal-table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Surface</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Health checks", "Status API"],
                        ["Latency", "Prometheus and Grafana"],
                        ["Target state", "API and dashboard"],
                        ["Alerts", "Alertmanager"],
                        ["Validation", "Local script and CI"],
                      ].map(([signal, surface]) => (
                        <tr key={signal}>
                          <td>{signal}</td>
                          <td>{surface}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="project-module">
                  <p className="module-label">Concrete proof</p>
                  <ul className="proof-list proof-list-iyup">
                    {[
                      "active health checks",
                      "Prometheus scraping",
                      "Grafana dashboarding",
                      "Alertmanager wiring",
                      "Docker Compose operation",
                      "Helm validation",
                      "repeatable verification",
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <p className="project-tech">
                  Go · FastAPI · Prometheus · Grafana · Alertmanager · Docker
                  Compose · Helm · GitHub Actions
                </p>

                <div className="limit-box">
                  <h4 className="limit-heading">Constraint</h4>
                  <p className="limit-copy">
                    Helm is render-validated here, not cluster-validated.
                  </p>
                </div>

                <a
                  className="repo-text-link repo-text-link-iyup"
                  href="https://github.com/fattah247/iYup"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                </a>
              </div>

              <div className="project-proof-col">
                <div>
                  <RepoShot
                    src="/projects/iyup/grafana-dashboard.png"
                    alt="Grafana dashboard from iYup showing service health and latency metrics."
                    caption="Grafana is the primary proof surface: target health, latency, and alert context share one operational view."
                    href="https://github.com/fattah247/iYup"
                    sizes="(max-width: 1024px) 100vw, 54vw"
                    tone="bg-[#101412]"
                    wide
                  />
                  <ul className="evidence-note-list">
                    <li>Health and latency are inspectable in the same frame.</li>
                    <li>Alert thresholds are attached to an operating surface.</li>
                  </ul>
                </div>

                <div>
                  <RepoShot
                    src="/projects/iyup/prometheus-targets.png"
                    alt="Prometheus targets page from iYup showing scrape state for monitored services."
                    caption="Target scraping is visible at the collection boundary, which makes bad dashboard assumptions easier to challenge."
                    href="https://github.com/fattah247/iYup"
                    sizes="(max-width: 1024px) 100vw, 54vw"
                    tone="bg-[#101412]"
                    wide
                  />
                  <ul className="evidence-note-list">
                    <li>Target availability can be verified before interpreting charts.</li>
                    <li>Collection health is part of the proof, not hidden behind the UI.</li>
                  </ul>
                </div>
              </div>
            </article>
          </ScrollReveal>

          <ScrollReveal>
            <article className="project-block">
              <div className="project-copy-col">
                <div className="project-marker project-marker-trustgate">
                  <p className="project-label">Android client trust lab</p>
                  <h3 className="project-title">TrustGate Android</h3>
                  <p className="project-subtitle">
                    A mobile trust lab for deciding when an Android payment
                    client should allow, warn, or block sensitive behavior.
                  </p>
                </div>

                <div className="project-module">
                  <p className="module-label">Trust decision matrix</p>
                  <table className="signal-table">
                    <thead>
                      <tr>
                        <th>Condition</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Low risk", "Allow"],
                        ["Medium risk", "Require confirmation"],
                        ["High risk", "Block"],
                        ["Request signing", "Attach timestamp, nonce, signature"],
                        ["Secure storage", "Store mock token and risk state"],
                      ].map(([condition, action]) => (
                        <tr key={condition}>
                          <td>{condition}</td>
                          <td>{action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="project-module">
                  <p className="module-label">Concrete proof</p>
                  <ul className="proof-list proof-list-trustgate">
                    {[
                      "device-risk signal handling",
                      "sensitive action gating",
                      "HMAC request signing",
                      "encrypted local storage",
                      "local security event trail",
                      "Android tests and CI",
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <p className="project-tech">
                  Kotlin · Android · Jetpack Compose · Jetpack Security · OkHttp
                  · GitHub Actions
                </p>

                <div className="limit-box">
                  <h4 className="limit-heading">Constraint</h4>
                  <p className="limit-copy">
                    Client checks are signals, not proof. No live attestation
                    backend.
                  </p>
                </div>

                <a
                  className="repo-text-link repo-text-link-trustgate"
                  href="https://github.com/fattah247/trustgate-android"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                </a>
              </div>

              <div className="project-proof-col">
                <div className="phone-proof-grid">
                  <div>
                    <RepoShot
                      src="/projects/trustgate/device-risk-details.png"
                      alt="Device risk details screen from TrustGate Android showing risk signals."
                      caption="Risk signals stay visible instead of collapsing into one reassuring label."
                      href="https://github.com/fattah247/trustgate-android"
                      sizes="(max-width: 1024px) 100vw, 25vw"
                      tone="bg-[#d7dce5]"
                      tall
                    />
                    <ul className="evidence-note-list">
                      <li>Risk state is inspectable before a sensitive action runs.</li>
                      <li>Client trust is framed as a condition, not a feeling.</li>
                    </ul>
                  </div>

                  <div>
                    <RepoShot
                      src="/projects/trustgate/security-event-log.png"
                      alt="Security event log screen from TrustGate Android."
                      caption="Blocked or gated behavior leaves a readable event trail instead of disappearing into client-side silence."
                      href="https://github.com/fattah247/trustgate-android"
                      sizes="(max-width: 1024px) 100vw, 25vw"
                      tone="bg-[#d7dce5]"
                      tall
                    />
                    <ul className="evidence-note-list">
                      <li>Security changes produce a traceable local event trail.</li>
                      <li>Blocked actions are documented as decisions, not guesses.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          </ScrollReveal>
        </section>

        <ScrollReveal>
          <section id="production" className="section-block">
            <div className="section-head">
              <div className="max-w-2xl">
                <p className="section-kicker">Production scope</p>
                <h2 className="section-heading">Work that informs the labs</h2>
              </div>
            </div>

            <div className="production-grid">
              <p className="lede">
                I work mostly around Android and payment systems:
                merchant-facing flows, app-to-service integration, transaction
                status handling, release coordination, production fixes, and
                mobile security hardening.
              </p>
              <p className="lede">
                I also contribute to early iOS merchant app work, including
                order creation, phone-based payment flows, and merchant
                business features.
              </p>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal stagger>
          <section id="stack" className="section-block">
            <div className="max-w-3xl">
              <p className="section-kicker">Tooling and systems</p>
              <h2 className="section-heading">Stack</h2>
            </div>

            <div className="stack-list">
              {stackGroups.map((group) => (
                <article className="stack-row reveal-child" key={group.title}>
                  <p className="stack-label">{group.title}</p>
                  <p className="stack-copy">{group.items}</p>
                </article>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal>
          <section id="contact" className="section-block">
            <div className="section-head">
              <div className="max-w-2xl">
                <p className="section-kicker">Contact</p>
                <h2 className="section-heading">If the problem is hard to explain, email is the right start</h2>
                <p className="lede">
                  Payment systems, Android reliability, backend observability,
                  and client trust are the conversations I want this page to
                  lead into.
                </p>
              </div>
            </div>

            <div className="contact-card">
              <p className="contact-label">Best channel</p>
              <a
                className="contact-email"
                href="mailto:fattahmuhammad17@gmail.com"
              >
                fattahmuhammad17@gmail.com
              </a>

              <div className="contact-actions">
                <a
                  className="action-link action-link-primary"
                  href="mailto:fattahmuhammad17@gmail.com"
                >
                  Send email
                </a>
                <CopyEmailButton email="fattahmuhammad17@gmail.com" />
              </div>

              <div className="contact-meta-grid">
                <div>
                  <p className="contact-label">Profiles</p>
                  <div className="contact-inline-links">
                    <a
                      className="underline-link"
                      href="https://github.com/fattah247"
                      target="_blank"
                      rel="noreferrer"
                    >
                      GitHub
                    </a>
                    <a
                      className="underline-link"
                      href="https://www.linkedin.com/in/muhammad24fattah/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>

                <div>
                  <p className="contact-label">Project repos</p>
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
                        <span className="project-link-meta">Open</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>Muhammad A. Fattah</p>
          <div className="footer-links">
            <a
              className="underline-link footer-link"
              href="https://github.com/fattah247"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="underline-link footer-link"
              href="https://www.linkedin.com/in/muhammad24fattah/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a
              className="underline-link footer-link"
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
