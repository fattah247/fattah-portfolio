import Image from "next/image";
import { CopyEmailLink } from "@/components/copy-email-link";
import { NavLinks } from "@/components/nav-links";
import { ScrollProgress } from "@/components/scroll-progress";

const navLinks = [
  { label: "Work", href: "#projects" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#contact" },
];

const stackGroups = [
  {
    title: "Mobile",
    items: "Kotlin, Android, Jetpack Compose, Java, Swift, SwiftUI, MVVM, mobile security",
  },
  {
    title: "Backend",
    items: "Spring Boot, FastAPI, REST APIs, WebSocket, Kafka, Oracle SQL, PostgreSQL",
  },
  {
    title: "Delivery",
    items: "GitHub Actions, Jenkins, Docker, Kubernetes, release coordination, production fixes",
  },
  {
    title: "Monitoring",
    items: "Prometheus, Grafana, Alertmanager, Dynatrace, ElasticSearch, service diagnostics",
  },
] as const;

const repoLinks = [
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

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-mark">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.09.68-.22.68-.5 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.58 2.35 1.13 2.92.86.09-.67.35-1.13.64-1.39-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.7.12 2.5.36 1.9-1.32 2.74-1.05 2.74-1.05.56 1.42.21 2.47.11 2.73.64.72 1.03 1.63 1.03 2.75 0 3.95-2.35 4.82-4.59 5.07.36.32.69.94.69 1.9 0 1.37-.01 2.48-.01 2.82 0 .28.18.6.69.49A10.24 10.24 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-mark">
      <path
        fill="currentColor"
        d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A1.97 1.97 0 0 0 3.28 5c0 1.08.88 1.95 1.95 1.95h.02A1.96 1.96 0 0 0 7.22 5 1.96 1.96 0 0 0 5.27 3h-.02ZM20 12.84C20 9.32 18.12 7.7 15.6 7.7c-2.03 0-2.94 1.13-3.45 1.92V8.5H8.77c.04.73 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.69.13-.93.27-.69.9-1.4 1.95-1.4 1.37 0 1.92 1.06 1.92 2.61V20h3.38v-6.83Z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-mark">
      <path
        fill="currentColor"
        d="M3 5.75A1.75 1.75 0 0 1 4.75 4h14.5A1.75 1.75 0 0 1 21 5.75v12.5A1.75 1.75 0 0 1 19.25 20H4.75A1.75 1.75 0 0 1 3 18.25V5.75Zm1.5.31v.2l7.13 5.25a.63.63 0 0 0 .74 0l7.13-5.25v-.2a.25.25 0 0 0-.25-.25H4.75a.25.25 0 0 0-.25.25Zm15 1.97-6.24 4.6a2.12 2.12 0 0 1-2.52 0L4.5 8.03v10.22c0 .14.11.25.25.25h14.5a.25.25 0 0 0 .25-.25V8.03Z"
      />
    </svg>
  );
}

function ArrowOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mini-icon">
      <path
        fill="currentColor"
        d="M14 5h5v5h-1.5V7.56l-7.97 7.97-1.06-1.06 7.97-7.97H14V5ZM6 7.75C6 6.78 6.78 6 7.75 6H12v1.5H7.75a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h8.5a.25.25 0 0 0 .25-.25V12H18v4.25c0 .97-.78 1.75-1.75 1.75h-8.5A1.75 1.75 0 0 1 6 16.25v-8.5Z"
      />
    </svg>
  );
}

function PayflowBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="stage-backdrop stage-backdrop-payflow"
      viewBox="0 0 640 320"
    >
      <path
        d="M0 180C90 145 150 145 230 180C310 215 370 215 450 180C530 145 585 145 640 170"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M0 220C90 185 150 185 230 220C310 255 370 255 450 220C530 185 585 185 640 210"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M0 140C90 105 150 105 230 140C310 175 370 175 450 140C530 105 585 105 640 130"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IyupBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="stage-backdrop stage-backdrop-iyup"
      viewBox="0 0 640 320"
    >
      <path
        d="M96 236L286 186L216 270L250 236L96 236Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M276 194C332 167 381 135 431 92C471 58 517 37 564 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="7 10"
      />
    </svg>
  );
}

function TrustgateBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="stage-backdrop stage-backdrop-trustgate"
      viewBox="0 0 640 320"
    >
      <rect
        x="180"
        y="120"
        width="168"
        height="120"
        rx="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M222 120V96C222 64 248 38 280 38C312 38 338 64 338 96V120"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M394 86H598V270H394"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M480 86V270" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
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
    <a className="artifact" href={href} target="_blank" rel="noreferrer">
      <div
        className={`artifact-frame ${tone} ${wide ? "artifact-frame-wide" : ""} ${tall ? "artifact-frame-tall" : ""}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top transition duration-200"
          sizes={sizes}
          unoptimized
        />
      </div>
      <div className="artifact-meta">
        <p className="artifact-caption-text">{caption}</p>
        <span className="artifact-link-mark">
          <ArrowOutIcon />
        </span>
      </div>
    </a>
  );
}

export default function Home() {
  return (
    <div className="page-shell">
      <div id="scroll-progress" aria-hidden="true" />
      <ScrollProgress />

      <header className="site-header">
        <div className="shell header-inner">
          <a href="#top" className="site-title">
            Muhammad A. Fattah
          </a>

          <div className="hidden items-center gap-7 lg:flex">
            <nav aria-label="Primary">
              <NavLinks links={navLinks} />
            </nav>

            <div className="nav-icons">
              <a
                aria-label="GitHub"
                className="icon-link"
                href="https://github.com/fattah247"
                target="_blank"
                rel="noreferrer"
              >
                <GitHubIcon />
              </a>
              <a
                aria-label="LinkedIn"
                className="icon-link"
                href="https://www.linkedin.com/in/muhammad24fattah/"
                target="_blank"
                rel="noreferrer"
              >
                <LinkedInIcon />
              </a>
              <a aria-label="Email" className="icon-link" href="#contact">
                <MailIcon />
              </a>
            </div>
          </div>

          <a className="ghost-link lg:hidden" href="#contact">
            Contact
          </a>
        </div>
      </header>

      <main id="top" className="shell">
        <section className="hero-section">
          <h1 className="hero-name">Muhammad A. Fattah</h1>
          <p className="hero-line">Payment systems. Android. Reliability.</p>
          <p className="hero-copy">
            I work on Android payment systems and build public labs around
            transaction reliability, observability, and client trust.
          </p>

          <div className="hero-actions">
            <a
              className="action-link action-link-primary"
              href="#projects"
              style={{ color: "#fff" }}
            >
              View work
            </a>
          </div>
        </section>

        <section id="projects" className="section-block">
          <div className="section-top">
            <h2 className="section-title">Selected work</h2>
          </div>

          <article className="project-stage project-stage-payflow">
            <PayflowBackdrop />

            <div className="project-aside">
              <div className="project-head">
                <h3 className="project-title">PayFlow Reliability</h3>
                <p className="project-summary">
                  Spring Boot payment failure handling: duplicate callbacks,
                  settlement mismatch, and guarded state transitions.
                </p>
              </div>

              <ul className="project-points">
                <li>Idempotency key handling</li>
                <li>Duplicate callback handling</li>
                <li>Settlement mismatch review</li>
                <li>Audit trail visibility</li>
              </ul>

              <div className="project-foot">
                <p className="project-tech">
                  Spring Boot · Java · PostgreSQL · Docker · GitHub Actions
                </p>
                <a
                  className="repo-link repo-link-payflow"
                  href="https://github.com/fattah247/payflow-reliability"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                  <ArrowOutIcon />
                </a>
              </div>
            </div>

            <div className="project-main">
              <RepoShot
                src="/projects/payflow/audit-trail.png"
                alt="Audit trail output from PayFlow Reliability showing state transitions."
                caption="Audit trail keeps payment state transitions readable instead of leaving them implied."
                href="https://github.com/fattah247/payflow-reliability"
                sizes="(max-width: 1024px) 100vw, 58vw"
                tone="bg-[#0f1823]"
                wide
              />

              <div className="project-detail-grid">
                <div className="project-panel">
                  <h4>Path</h4>
                  <div className="flow-strip">
                    {[
                      "Request",
                      "Intent",
                      "Webhook",
                      "Settlement",
                      "Reconcile",
                      "Review",
                      "Audit",
                    ].map((item) => (
                      <span className="flow-step" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <RepoShot
                  src="/projects/payflow/duplicate-webhook.png"
                  alt="Duplicate provider webhook handled and ignored in PayFlow Reliability."
                  caption="Duplicate callbacks show up as handled behavior, not as a hidden assumption."
                  href="https://github.com/fattah247/payflow-reliability"
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  tone="bg-[#0f1823]"
                  wide
                />
              </div>
            </div>
          </article>

          <article className="project-stage project-stage-iyup">
            <IyupBackdrop />

            <div className="project-aside">
              <div className="project-head">
                <h3 className="project-title">iYup</h3>
                <p className="project-summary">
                  Service health and observability with health checks,
                  Prometheus, Grafana, and alert routing.
                </p>
              </div>

              <ul className="project-points">
                <li>Health checks</li>
                <li>Prometheus scraping</li>
                <li>Grafana dashboards</li>
                <li>Alertmanager wiring</li>
              </ul>

              <div className="project-foot">
                <p className="project-tech">
                  Go · FastAPI · Prometheus · Grafana · Alertmanager · Docker
                  Compose · Helm · GitHub Actions
                </p>
                <a
                  className="repo-link repo-link-iyup"
                  href="https://github.com/fattah247/iYup"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                  <ArrowOutIcon />
                </a>
              </div>
            </div>

            <div className="project-main">
              <RepoShot
                src="/projects/iyup/grafana-dashboard.png"
                alt="Grafana dashboard from iYup showing service health and latency metrics."
                caption="Grafana is the main proof surface: health, latency, and alert state live together."
                href="https://github.com/fattah247/iYup"
                sizes="(max-width: 1024px) 100vw, 58vw"
                tone="bg-[#101412]"
                wide
              />

              <div className="project-detail-grid">
                <div className="project-panel">
                  <h4>Signals</h4>
                  <table className="signal-table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Surface</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Health", "Status API"],
                        ["Latency", "Prometheus and Grafana"],
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

                <RepoShot
                  src="/projects/iyup/prometheus-targets.png"
                  alt="Prometheus targets page from iYup showing scrape state for monitored services."
                  caption="Target scraping is visible at the collection boundary."
                  href="https://github.com/fattah247/iYup"
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  tone="bg-[#101412]"
                  wide
                />
              </div>
            </div>
          </article>

          <article className="project-stage project-stage-trustgate">
            <TrustgateBackdrop />

            <div className="project-aside">
              <div className="project-head">
                <h3 className="project-title">TrustGate Android</h3>
                <p className="project-summary">
                  Risky-device client behavior, gated actions, request signing,
                  and a visible security event trail.
                </p>
              </div>

              <ul className="project-points">
                <li>Risk signal handling</li>
                <li>Sensitive action gating</li>
                <li>Request signing</li>
                <li>Security event trail</li>
              </ul>

              <div className="project-foot">
                <p className="project-tech">
                  Kotlin · Android · Jetpack Compose · Jetpack Security · OkHttp
                  · GitHub Actions
                </p>
                <a
                  className="repo-link repo-link-trustgate"
                  href="https://github.com/fattah247/trustgate-android"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                  <ArrowOutIcon />
                </a>
              </div>
            </div>

            <div className="project-main">
              <div className="phone-grid">
                <RepoShot
                  src="/projects/trustgate/device-risk-details.png"
                  alt="Device risk details screen from TrustGate Android showing risk signals."
                  caption="Risk state stays visible before a sensitive action runs."
                  href="https://github.com/fattah247/trustgate-android"
                  sizes="(max-width: 1024px) 100vw, 28vw"
                  tone="bg-[#d7dce5]"
                  tall
                />

                <RepoShot
                  src="/projects/trustgate/security-event-log.png"
                  alt="Security event log screen from TrustGate Android."
                  caption="Blocked or gated behavior leaves a readable local trail."
                  href="https://github.com/fattah247/trustgate-android"
                  sizes="(max-width: 1024px) 100vw, 28vw"
                  tone="bg-[#d7dce5]"
                  tall
                />
              </div>

              <div className="decision-strip">
                <div>
                  <span>Low risk</span>
                  <p>Allow</p>
                </div>
                <div>
                  <span>Medium risk</span>
                  <p>Confirm</p>
                </div>
                <div>
                  <span>High risk</span>
                  <p>Block</p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="section-block section-block-compact">
          <div className="section-top">
            <h2 className="section-title">Current work</h2>
          </div>

          <div className="current-grid">
            <article>
              <h3>Android payments</h3>
              <ul>
                <li>Merchant-facing payment flows</li>
                <li>Transaction status handling</li>
                <li>Mobile security hardening</li>
              </ul>
            </article>

            <article>
              <h3>Backend delivery</h3>
              <ul>
                <li>App-to-service integration</li>
                <li>Release coordination</li>
                <li>Production fixes</li>
              </ul>
            </article>

            <article>
              <h3>iOS support</h3>
              <ul>
                <li>Order creation flow</li>
                <li>Phone-based payments</li>
                <li>Merchant business features</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="stack" className="section-block section-block-compact">
          <div className="section-top">
            <h2 className="section-title">Stack</h2>
          </div>

          <div className="stack-list">
            {stackGroups.map((group) => (
              <article className="stack-row" key={group.title}>
                <p className="stack-label">{group.title}</p>
                <p className="stack-copy">{group.items}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="section-block section-block-compact">
          <div className="section-top">
            <h2 className="section-title">Need help on payments, Android, or reliability?</h2>
          </div>

          <CopyEmailLink email="fattahmuhammad17@gmail.com" />

          <div className="contact-links">
            <a
              className="inline-link"
              href="https://github.com/fattah247"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="inline-link"
              href="https://www.linkedin.com/in/muhammad24fattah/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          </div>

          <div className="repo-list">
            {repoLinks.map((item) => (
              <a
                className="repo-row"
                href={item.href}
                key={item.href}
                target="_blank"
                rel="noreferrer"
              >
                <span>{item.label}</span>
                <ArrowOutIcon />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
