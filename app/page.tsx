import Image from "next/image";
import { CopyEmailButton } from "@/components/copy-email-button";
import { ParallaxBlock } from "@/components/parallax-block";
import { ScrollProgress } from "@/components/scroll-progress";
import { ScrollReveal } from "@/components/scroll-reveal";
import { AmbientMarks } from "@/components/ambient-marks";

const navLinks = [
  { label: "Current focus", href: "#focus" },
  { label: "Selected labs", href: "#labs" },
  { label: "Production work", href: "#production" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#contact" },
];

const profileLinks = [
  { label: "GitHub", href: "https://github.com/fattah247" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/muhammad24fattah/" },
];

const failureCases = [
  { surface: "Duplicate payment callback", lab: "PayFlow Reliability", colorClass: "text-[color:var(--payflow)]" },
  { surface: "Unclear transaction state", lab: "PayFlow Reliability", colorClass: "text-[color:var(--payflow)]" },
  { surface: "Settlement mismatch", lab: "PayFlow Reliability", colorClass: "text-[color:var(--payflow)]" },
  { surface: "Service looks up but is slow", lab: "iYup", colorClass: "text-[color:var(--iyup)]" },
  { surface: "Dashboard shows status only", lab: "iYup", colorClass: "text-[color:var(--iyup)]" },
  { surface: "Risky Android environment", lab: "TrustGate Android", colorClass: "text-[color:var(--trustgate)]" },
  { surface: "Sensitive action on risky device", lab: "TrustGate Android", colorClass: "text-[color:var(--trustgate)]" },
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
    items: "Docker, Kubernetes, Jenkins, GitHub Actions, Prometheus, Grafana, Alertmanager, Dynatrace, ElasticSearch",
  },
  {
    title: "Security",
    items: "Mobile security, application hardening, request signing, encrypted storage, root/emulator signal checks",
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
          unoptimized={true}
        />
        <div className="artifact-overlay">Open repo →</div>
      </ParallaxBlock>
      <div className="artifact-caption">
        <p className="artifact-caption-text">{caption}</p>
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
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[rgba(244,241,234,0.92)] backdrop-blur-md">
        <div className="shell flex min-h-16 items-center justify-between gap-4">
          <a
            href="#top"
            className="text-[0.8rem] font-bold tracking-[0.12em] uppercase text-[color:var(--text)]"
          >
            Muhammad A. Fattah
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            <nav aria-label="Primary">
              <ul className="flex items-center gap-6 text-sm text-[color:var(--muted)]">
                {navLinks.map((item) => (
                  <li key={item.href}>
                    <a className="nav-link font-semibold" href={item.href}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-4 text-sm text-[color:var(--muted)] border-l border-[color:var(--line)] pl-4">
              {profileLinks.map((item) => (
                <a
                  className="nav-link font-semibold"
                  href={item.href}
                  key={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              ))}
              <a className="nav-link font-semibold" href="mailto:fattahmuhammad17@gmail.com">
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
        <section className="relative overflow-hidden pb-12 pt-20">
          <AmbientMarks />

          <ScrollReveal>
            <div className="max-w-5xl">
              <h1 className="hero-name">Muhammad A. Fattah</h1>
              <p className="hero-subtitle">
                Payment systems engineer working on Android reliability, transaction failure states, observability, and mobile-client trust.
              </p>
              <p className="hero-body">
                I build public labs around the boring parts of payment software: duplicate callbacks, unclear transaction states, weak service visibility, and Android clients that trust too much.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a className="btn-primary" href="#labs">
                  View labs
                </a>
                {profileLinks.map((item) => (
                  <a
                    className="btn-ghost"
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
                  className="btn-ghost"
                  href="mailto:fattahmuhammad17@gmail.com"
                >
                  Email
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--muted)]">
                <a
                  className="underline-link font-mono text-[0.92rem] font-medium"
                  href="mailto:fattahmuhammad17@gmail.com"
                >
                  fattahmuhammad17@gmail.com
                </a>
                <CopyEmailButton email="fattahmuhammad17@gmail.com" />
              </div>

              <p
                className="mt-10 font-mono text-[0.72rem] font-bold tracking-[0.1em] uppercase text-[color:var(--muted)]"
                aria-hidden="true"
              >
                ↓ scroll dossier
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* ── Thesis: three failure cases ───────────────────── */}
        <ScrollReveal>
          <section className="major-rule py-16">
            <div className="max-w-4xl">
              <h2 className="thesis-heading">
                I build around three failure cases:
              </h2>
              <ol className="thesis-list" aria-label="Three failure cases">
                <li className="thesis-item">
                  <span className="thesis-num-01 font-mono block text-xs tracking-wider font-bold mb-1">01</span>
                  Payments that fail without clear state.
                </li>
                <li className="thesis-item">
                  <span className="thesis-num-02 font-mono block text-xs tracking-wider font-bold mb-1">02</span>
                  Dashboards that show numbers but not causes.
                </li>
                <li className="thesis-item">
                  <span className="thesis-num-03 font-mono block text-xs tracking-wider font-bold mb-1">03</span>
                  Android clients that trust unsafe devices.
                </li>
              </ol>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Current focus ─────────────────────────────────── */}
        <ScrollReveal stagger>
          <section id="focus" className="major-rule py-16">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
              <div className="max-w-2xl">
                <h2 className="section-heading">Current focus</h2>
                <p className="mt-5 lede">
                  The same failures kept appearing in different forms: a payment that did not clearly succeed or fail, a dashboard that showed status but not cause, a mobile client trusted too easily.
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
                    <span className="focus-num">{note.num}</span>
                    <h3 className="focus-title">{note.title}</h3>
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
                I did not want three random portfolio repos. I wanted one backend project, one observability project, and one Android security project that orbit the same problem:
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

        {/* ── Failure index table ───────────────────────────── */}
        <ScrollReveal>
          <section className="major-rule pb-16 pt-16">
            <div className="max-w-5xl">
              <h2 className="section-heading">Failure index</h2>
              <p className="mt-4 max-w-3xl text-lg text-[color:var(--body)]">
                One reason these repos belong together: each one models a different failure surface from payment-adjacent systems.
              </p>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="failure-table">
                <thead>
                  <tr>
                    <th>Failure surface</th>
                    <th>Lab</th>
                  </tr>
                </thead>
                <tbody>
                  {failureCases.map((item) => (
                    <tr key={item.surface}>
                      <td>{item.surface}</td>
                      <td className={`${item.colorClass} font-mono font-semibold`}>
                        {item.lab}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Selected labs ─────────────────────────────────── */}
        <section id="labs" className="major-rule py-16">
          <ScrollReveal>
            <div className="max-w-3xl">
              <h2 className="section-heading">Selected labs</h2>
            </div>
          </ScrollReveal>

          {/* PayFlow Reliability */}
          <ScrollReveal>
            <article className="mt-14 grid gap-12 pt-12 border-t border-[color:var(--line)] lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
              {/* Left Column: explanation & proof */}
              <div className="space-y-6">
                <div className="project-accent-payflow">
                  <h3 className="project-title">PayFlow Reliability</h3>
                  <p className="project-subtitle">
                    A Spring Boot reliability lab for payment-like flows: idempotency, duplicate callbacks, settlement mismatch, webhook failure, and state transitions.
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)]">State Transition Flow</p>
                  <div className="flow-strip">
                    {[
                      { label: "Request", warn: false },
                      { label: "Idempotency", warn: false },
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
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)]">System Evidence</p>
                  <ul className="proof-list">
                    {[
                      "idempotency key handling",
                      "duplicate callback handling",
                      "guarded state transitions",
                      "settlement mismatch",
                      "manual review",
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

                <div className="p-4 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-lg">
                  <h4 className="text-sm font-bold text-[color:var(--text)]">System Constraints</h4>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    Local lab, not a payment processor.
                  </p>
                </div>

                <div className="pt-2">
                  <a
                    className="underline-link text-base font-bold flex items-center gap-1"
                    href="https://github.com/fattah247/payflow-reliability"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View repository <ExternalArrow />
                  </a>
                </div>
              </div>

              {/* Right Column: Screenshot & Log Dossier */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <RepoShot
                      src="/projects/payflow/audit-trail.png"
                      alt="Audit trail output from PayFlow Reliability showing state transitions."
                      caption="Audit trail: state transitions and operator-relevant events stay readable."
                      href="https://github.com/fattah247/payflow-reliability"
                      sizes="(max-width: 1024px) 100vw, 58vw"
                      tone="bg-[#0e1621]"
                      wide
                    />
                    <ul className="mt-3 text-xs space-y-1.5 text-[color:var(--muted)] list-disc pl-4">
                      <li><strong>Audit event visible:</strong> Concrete trace of execution state at each checkpoint.</li>
                      <li><strong>Transaction state preserved:</strong> Guarded transitions prevent state corruption under pressure.</li>
                    </ul>
                  </div>

                  <div>
                    <RepoShot
                      src="/projects/payflow/duplicate-webhook.png"
                      alt="Duplicate provider webhook handled and ignored in PayFlow Reliability."
                      caption="Duplicate callback handling is visible in the response, not implied."
                      href="https://github.com/fattah247/payflow-reliability"
                      sizes="(max-width: 1024px) 100vw, 58vw"
                      tone="bg-[#0e1621]"
                      wide
                    />
                    <ul className="mt-3 text-xs space-y-1.5 text-[color:var(--muted)] list-disc pl-4">
                      <li><strong>Duplicate callback ignored:</strong> The idempotency filter detects and discards replayed webhooks.</li>
                      <li><strong>Settlement mismatch logged:</strong> Reconciliation detects discrepancy and flags it for review.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          </ScrollReveal>

          {/* iYup */}
          <ScrollReveal>
            <article className="mt-14 pt-12 border-t border-[color:var(--line)] space-y-8">
              <div className="project-accent-iyup">
                <h3 className="project-title">iYup</h3>
                <p className="project-subtitle">
                  iYup is a small observability monitor for backend services: health status, latency, metrics, alert states, and service visibility.
                </p>
              </div>

              {/* Hero Screenshot for iYup: Large, full-width dashboard */}
              <div className="w-full">
                <RepoShot
                  src="/projects/iyup/grafana-dashboard.png"
                  alt="Grafana dashboard from iYup showing service health and latency metrics."
                  caption="Grafana dashboard: target health, latency metrics, and alert triggers in one dashboard."
                  href="https://github.com/fattah247/iYup"
                  sizes="100vw"
                  tone="bg-[#101412]"
                  wide
                />
                <ul className="mt-3 text-xs md:text-sm space-y-1.5 text-[color:var(--muted)] list-disc pl-4 grid sm:grid-cols-2 gap-x-6">
                  <li><strong>Health check & Latency:</strong> Real-time scrapers record status codes and p95/p99 latency buckets.</li>
                  <li><strong>Service visibility:</strong> Provides instantaneous status monitoring for all registered backend targets.</li>
                </ul>
              </div>

              <div className="grid gap-12 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
                {/* Left: Signals table */}
                <div className="space-y-4">
                  <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)]">Monitored Signals</p>
                  <table className="failure-table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Surface</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { signal: "Health checks", surface: "Status API" },
                        { signal: "Latency", surface: "Prometheus / Grafana" },
                        { signal: "Target state", surface: "API / dashboard" },
                        { signal: "Alerts", surface: "Alertmanager" },
                        { signal: "Validation", surface: "local script / CI" },
                      ].map((item) => (
                        <tr key={item.signal}>
                          <td className="font-mono text-xs">{item.signal}</td>
                          <td>{item.surface}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Right: Prometheus screenshot & details */}
                <div className="space-y-6">
                  <div>
                    <RepoShot
                      src="/projects/iyup/prometheus-targets.png"
                      alt="Prometheus targets page from iYup showing scrape state for monitored services."
                      caption="Prometheus targets: scrape state is directly inspectable, not inferred."
                      href="https://github.com/fattah247/iYup"
                      sizes="(max-width: 1024px) 100vw, 48vw"
                      tone="bg-[#101412]"
                      wide
                    />
                    <ul className="mt-3 text-xs space-y-1.5 text-[color:var(--muted)] list-disc pl-4">
                      <li><strong>Alert state:</strong> PromQL rules trigger routing thresholds directly to alert managers.</li>
                      <li><strong>Prometheus target scrapers:</strong> Monitors target connectivity metrics directly at the collection boundary.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)]">System Evidence</p>
                    <ul className="proof-list proof-list-green">
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
                    Go · FastAPI · Prometheus · Grafana · Alertmanager · Docker Compose · Helm · GitHub Actions
                  </p>

                  <div className="p-4 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-lg">
                    <h4 className="text-sm font-bold text-[color:var(--text)]">System Constraints</h4>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      Helm is render-validated here, not cluster-validated.
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      className="underline-link text-base font-bold flex items-center gap-1"
                      href="https://github.com/fattah247/iYup"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View repository <ExternalArrow />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </ScrollReveal>

          {/* TrustGate Android */}
          <ScrollReveal>
            <article className="mt-14 pt-12 border-t border-[color:var(--line)]">
              <div className="grid gap-12 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
                {/* Left Column: explanation & Decision Matrix */}
                <div className="space-y-6">
                  <div className="project-accent-trustgate">
                    <h3 className="project-title">TrustGate Android</h3>
                    <p className="project-subtitle">
                      A mobile trust lab for deciding when an Android payment client should allow, warn, or block sensitive behavior.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)]">Trust Decision Matrix</p>
                    <table className="failure-table">
                      <thead>
                        <tr>
                          <th>Condition</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { cond: "Low risk", action: "allow" },
                          { cond: "Medium risk", action: "require confirmation" },
                          { cond: "High risk", action: "block" },
                          { cond: "Signed request", action: "attach timestamp, nonce, signature" },
                          { cond: "Secure storage", action: "store mock token / risk state" },
                        ].map((item) => (
                          <tr key={item.cond}>
                            <td className="font-mono text-xs">{item.cond}</td>
                            <td>{item.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)]">System Evidence</p>
                    <ul className="proof-list proof-list-amber">
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
                    Kotlin · Android · Jetpack Compose · Jetpack Security · OkHttp · GitHub Actions
                  </p>

                  <div className="p-4 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-lg">
                    <h4 className="text-sm font-bold text-[color:var(--text)]">System Constraints</h4>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      Client checks are signals, not proof. No live attestation backend.
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      className="underline-link text-base font-bold flex items-center gap-1"
                      href="https://github.com/fattah247/trustgate-android"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View repository <ExternalArrow />
                    </a>
                  </div>
                </div>

                {/* Right Column: Phone Screenshots */}
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <RepoShot
                        src="/projects/trustgate/device-risk-details.png"
                        alt="Device risk details screen from TrustGate Android showing risk signals."
                        caption="Low-risk state: risk signals stay visible instead of hidden behind a single score."
                        href="https://github.com/fattah247/trustgate-android"
                        sizes="(max-width: 1024px) 100vw, 24vw"
                        tone="bg-[#d6d0c7]"
                        tall
                      />
                      <ul className="mt-3 text-xs space-y-1.5 text-[color:var(--muted)] list-disc pl-4">
                        <li><strong>Risk state visible:</strong> Low-risk signals (root/emulator check) are shown explicitly.</li>
                        <li><strong>Low-risk action allowed:</strong> Safe environment allows standard execution flow.</li>
                      </ul>
                    </div>

                    <div>
                      <RepoShot
                        src="/projects/trustgate/security-event-log.png"
                        alt="Security event log screen from TrustGate Android."
                        caption="Security event log: blocked or gated behavior leaves an inspectable trail."
                        href="https://github.com/fattah247/trustgate-android"
                        sizes="(max-width: 1024px) 100vw, 24vw"
                        tone="bg-[#d6d0c7]"
                        tall
                      />
                      <ul className="mt-3 text-xs space-y-1.5 text-[color:var(--muted)] list-disc pl-4">
                        <li><strong>Security event logged:</strong> Risk changes and user validations trigger logging events.</li>
                        <li><strong>Sensitive action blocked:</strong> High-risk detection triggers active block state.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </ScrollReveal>
        </section>

        {/* ── Production work ─────────────────────────────────── */}
        <ScrollReveal>
          <section id="production" className="major-rule py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
              <div>
                <h2 className="section-heading">Production work</h2>
              </div>

              <div className="space-y-6 text-[color:var(--body)] text-[1.05rem] leading-[1.75]">
                <p>
                  I work mostly around Android and payment systems: merchant-facing payment flows, app-to-service integration, transaction status handling, release coordination, production fixes, and mobile security hardening.
                </p>
                <p>
                  I also contribute to early iOS Merchant App work, including base implementation for order creation, phone-based payment flows, and merchant business features.
                </p>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* ── Stack ─────────────────────────────────────────── */}
        <ScrollReveal stagger>
          <section id="stack" className="major-rule py-16">
            <div className="max-w-3xl">
              <h2 className="section-heading">Stack</h2>
            </div>

            <div className="mt-8">
              {stackGroups.map((group) => (
                <article className="stack-row reveal-child" key={group.title}>
                  <p className="stack-label">{group.title}</p>
                  <p className="text-base leading-7 text-[color:var(--muted)] font-medium">
                    {group.items}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* ── Contact ───────────────────────────────────────── */}
        <ScrollReveal>
          <section id="contact" className="major-rule py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
              <div>
                <h2 className="section-heading">Contact</h2>
                <p className="mt-4 text-[color:var(--body)] text-[1.05rem] leading-[1.7]">
                  Engineering conversations around payment systems, Android, backend reliability, observability, and platform work are welcome.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <a
                    className="underline-link font-bold text-base"
                    href="mailto:fattahmuhammad17@gmail.com"
                  >
                    Email
                  </a>
                  <a
                    className="underline-link font-bold text-base"
                    href="https://github.com/fattah247"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                    <ExternalArrow />
                  </a>
                  <a
                    className="underline-link font-bold text-base"
                    href="https://www.linkedin.com/in/muhammad24fattah/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                    <ExternalArrow />
                  </a>
                  <CopyEmailButton email="fattahmuhammad17@gmail.com" />
                </div>

                <div className="pt-4 border-t border-[color:var(--line)]">
                  <p className="text-xs font-mono font-bold tracking-wider uppercase text-[color:var(--muted)] mb-2">Selected Labs Repositories</p>
                  <div className="grid gap-2">
                    {projectLinks.map((item) => (
                      <a
                        className="project-link-row"
                        href={item.href}
                        key={item.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="font-mono text-sm font-semibold">{item.label}</span>
                        <span className="project-link-arrow"><ExternalArrow /></span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="border-t border-[color:var(--line)] py-8">
        <div className="shell flex flex-col gap-3 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Muhammad A. Fattah</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              className="underline-link text-[color:var(--muted)] font-medium"
              href="https://github.com/fattah247"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="underline-link text-[color:var(--muted)] font-medium"
              href="https://www.linkedin.com/in/muhammad24fattah/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a
              className="underline-link text-[color:var(--muted)] font-medium"
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
