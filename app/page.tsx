import Image from "next/image";
import { CopyEmailButton } from "@/components/copy-email-button";
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
          className="object-cover object-top transition duration-200 group-hover:scale-[1.02] group-focus-visible:scale-[1.02]"
          sizes={sizes}
          unoptimized
        />
      </div>
      <p className="artifact-caption-text">{caption}</p>
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

          <div className="hidden items-center gap-8 lg:flex">
            <nav aria-label="Primary">
              <NavLinks links={navLinks} />
            </nav>

            <a
              className="header-link"
              href="https://github.com/fattah247"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
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
            <a className="action-link action-link-primary" href="#projects">
              View work
            </a>
          </div>

          <div className="hero-links">
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
            <a className="inline-link" href="mailto:fattahmuhammad17@gmail.com">
              fattahmuhammad17@gmail.com
            </a>
            <CopyEmailButton email="fattahmuhammad17@gmail.com" />
          </div>

          <div className="story-strip">
            <article>
              <h2>PayFlow Reliability</h2>
              <p>Backend payment failure handling.</p>
            </article>
            <article>
              <h2>iYup</h2>
              <p>Service health and observability.</p>
            </article>
            <article>
              <h2>TrustGate Android</h2>
              <p>Risky-device client behavior.</p>
            </article>
          </div>
        </section>

        <section id="projects" className="section-block">
          <div className="section-top">
            <h2 className="section-title">Selected work</h2>
          </div>

          <article className="project-stage">
            <div className="project-aside">
              <h3 className="project-title">PayFlow Reliability</h3>
              <p className="project-summary">
                A Spring Boot lab for payment-like flows: duplicate callbacks,
                settlement mismatch, and guarded state transitions.
              </p>

              <ul className="project-points">
                <li>Idempotency key handling</li>
                <li>Duplicate callback handling</li>
                <li>Settlement mismatch review</li>
                <li>Audit trail visibility</li>
              </ul>

              <p className="project-tech">
                Spring Boot · Java · PostgreSQL · Docker · GitHub Actions
              </p>
              <p className="project-note">
                Local lab, not a payment processor.
              </p>

              <a
                className="repo-link repo-link-payflow"
                href="https://github.com/fattah247/payflow-reliability"
                target="_blank"
                rel="noreferrer"
              >
                Repository
              </a>
            </div>

            <div className="project-main">
              <RepoShot
                src="/projects/payflow/audit-trail.png"
                alt="Audit trail output from PayFlow Reliability showing state transitions."
                caption="Audit trail keeps state transitions readable instead of leaving payment history implied."
                href="https://github.com/fattah247/payflow-reliability"
                sizes="(max-width: 1024px) 100vw, 56vw"
                tone="bg-[#0e1621]"
                wide
              />

              <div className="project-detail-grid">
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

                <RepoShot
                  src="/projects/payflow/duplicate-webhook.png"
                  alt="Duplicate provider webhook handled and ignored in PayFlow Reliability."
                  caption="Duplicate callbacks show up as handled behavior, not as a hidden assumption."
                  href="https://github.com/fattah247/payflow-reliability"
                  sizes="(max-width: 1024px) 100vw, 56vw"
                  tone="bg-[#0e1621]"
                  wide
                />
              </div>
            </div>
          </article>

          <article className="project-stage">
            <div className="project-aside">
              <h3 className="project-title">iYup</h3>
              <p className="project-summary">
                A self-hosted monitor for service health, latency, metrics, and
                alert state.
              </p>

              <ul className="project-points">
                <li>Health checks</li>
                <li>Prometheus scraping</li>
                <li>Grafana dashboards</li>
                <li>Alertmanager wiring</li>
              </ul>

              <p className="project-tech">
                Go · FastAPI · Prometheus · Grafana · Alertmanager · Docker
                Compose · Helm · GitHub Actions
              </p>
              <p className="project-note">
                Helm is render-validated here, not cluster-validated.
              </p>

              <a
                className="repo-link repo-link-iyup"
                href="https://github.com/fattah247/iYup"
                target="_blank"
                rel="noreferrer"
              >
                Repository
              </a>
            </div>

            <div className="project-main">
              <RepoShot
                src="/projects/iyup/grafana-dashboard.png"
                alt="Grafana dashboard from iYup showing service health and latency metrics."
                caption="Grafana is the first proof surface: target health, latency, and alert state share one view."
                href="https://github.com/fattah247/iYup"
                sizes="(max-width: 1024px) 100vw, 56vw"
                tone="bg-[#101412]"
                wide
              />

              <div className="project-split">
                <div>
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
                  sizes="(max-width: 1024px) 100vw, 28vw"
                  tone="bg-[#101412]"
                  wide
                />
              </div>
            </div>
          </article>

          <article className="project-stage">
            <div className="project-aside">
              <h3 className="project-title">TrustGate Android</h3>
              <p className="project-summary">
                A mobile trust lab for deciding when an Android payment client
                should allow, confirm, or block sensitive behavior.
              </p>

              <ul className="project-points">
                <li>Risk signal handling</li>
                <li>Sensitive action gating</li>
                <li>Request signing</li>
                <li>Security event trail</li>
              </ul>

              <p className="project-tech">
                Kotlin · Android · Jetpack Compose · Jetpack Security · OkHttp
                · GitHub Actions
              </p>
              <p className="project-note">
                Client checks are signals, not proof.
              </p>

              <a
                className="repo-link repo-link-trustgate"
                href="https://github.com/fattah247/trustgate-android"
                target="_blank"
                rel="noreferrer"
              >
                Repository
              </a>
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
                  <p>Require confirmation</p>
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

          <div className="two-col-copy">
            <p>
              I work mostly around Android and payment systems: merchant-facing
              flows, app-to-service integration, transaction status handling,
              release coordination, production fixes, and mobile security
              hardening.
            </p>
            <p>
              I also contribute to early iOS merchant app work, including order
              creation, phone-based payment flows, and merchant business
              features.
            </p>
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
            <h2 className="section-title">Contact</h2>
          </div>

          <p className="contact-copy">
            For payment systems, Android, reliability, or monitoring work:
          </p>
          <a className="contact-email" href="mailto:fattahmuhammad17@gmail.com">
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
                <span>Open</span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
