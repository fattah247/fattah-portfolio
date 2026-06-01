import Image from "next/image";

const stackGroups = [
  {
    title: "Mobile",
    items: "Kotlin, Java, Android, Jetpack Compose, Swift, SwiftUI",
  },
  {
    title: "Backend",
    items: "Spring Boot, REST API, WebSocket, Kafka, Oracle SQL",
  },
  {
    title: "Platform",
    items:
      "Docker, Kubernetes, Jenkins, GitHub Actions, Prometheus, Grafana, Dynatrace, ElasticSearch",
  },
  {
    title: "Security",
    items:
      "Mobile security, root and emulator detection, request signing, encrypted storage, app hardening",
  },
  {
    title: "Operations",
    items: "Payment systems, incident response, root cause analysis",
  },
] as const;

const interactionScript = String.raw`(() => {
  if (window.__fattahSiteReady) {
    return;
  }

  window.__fattahSiteReady = true;

  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileMedia = window.matchMedia("(max-width: 767px)");
  const brand = document.querySelector("[data-header-brand]");
  const hero = document.getElementById("hero-name");
  const heroLinks = document.getElementById("hero-links");
  const progress = document.getElementById("scroll-progress");
  const emailShell = document.getElementById("contact-email");
  const toast = document.querySelector("[data-copy-toast]");
  const viewer = document.querySelector("[data-viewer-root]");
  const viewerImage = document.querySelector("[data-viewer-image]");
  const viewerCaption = document.querySelector("[data-viewer-caption]");
  const viewerMedia = document.querySelector("[data-viewer-media]");
  const viewerScale = document.querySelector("[data-viewer-scale]");
  const navItems = Array.from(document.querySelectorAll("[data-nav-target]"));
  const stageItems = Array.from(document.querySelectorAll("[data-stage]"));
  const sectionItems = ["projects", "stack"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const copyButton = document.querySelector("[data-copy-email]");
  const artifactButtons = Array.from(document.querySelectorAll("[data-artifact-src]"));

  let flashTimer = 0;
  let toastTimer = 0;
  let zoom = 1;

  root.setAttribute("data-interact-ready", "yes");

function setBrand(visible) {
  if (!brand) {
    return;
  }

  root.classList.toggle("desk-hero-away", visible);
  brand.classList.toggle("site-title-visible", visible);
  brand.setAttribute("aria-hidden", visible ? "false" : "true");
  brand.tabIndex = visible ? 0 : -1;
}

function syncBrand() {
  if (mobileMedia.matches) {
    root.classList.remove("desk-hero-away");
    setBrand(false);
    return;
  }

    if (!hero) {
      setBrand(true);
      return;
    }

    const rect = hero.getBoundingClientRect();
    const heroEdge = rect.y + rect.height;
    setBrand(heroEdge <= 84 || rect.top < -84);
  }

  function setMobileHeroState(heroVisible) {
    root.classList.toggle("mobile-hero-hidden", mobileMedia.matches && !heroVisible);
  }

  function syncMobileHeroState() {
    const source = heroLinks || hero;

    if (!source) {
      setMobileHeroState(false);
      return;
    }

    const rect = source.getBoundingClientRect();
    const sourceVisible = rect.bottom > 0 && rect.top < window.innerHeight && rect.height > 0;
    setMobileHeroState(sourceVisible);
  }

  function setProgress() {
    if (!progress) {
      return;
    }

    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct = total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0;
    progress.style.width = pct + "%";
  }

  function markActive(id) {
    navItems.forEach((item) => {
      const active = item.getAttribute("data-nav-target") === id;
      item.classList.toggle("nav-link-active", active);

      if (active) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  function flashEmail() {
    if (!emailShell) {
      return;
    }

    emailShell.classList.add("copy-email-shell-active");
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      emailShell.classList.remove("copy-email-shell-active");
    }, 1800);
  }

  function showToast() {
    if (!toast || !emailShell) {
      return;
    }

    emailShell.classList.add("copy-email-shell-copied");
    toast.textContent = "Copied";
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      emailShell.classList.remove("copy-email-shell-copied");
    }, 1800);
  }

  async function copyText(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, field.value.length);
    const copied = document.execCommand("copy");
    field.remove();
    if (copied) {
      return true;
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  async function copyMail(text) {
    flashEmail();

    try {
      const ok = await copyText(text);
      if (!ok) {
        if (toast) {
          toast.textContent = "Copy failed";
          toast.hidden = false;
          window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => {
            toast.hidden = true;
          }, 1800);
        }
        return;
      }
      showToast();
    } catch {
      if (toast) {
        toast.textContent = "Copy failed";
        toast.hidden = false;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
          toast.hidden = true;
        }, 1800);
      }
    }
  }

  function applyZoom() {
    if (!viewerMedia) {
      return;
    }

    viewerMedia.style.transform = "scale(" + zoom + ")";

    if (viewerScale) {
      viewerScale.textContent = Math.round(zoom * 100) + "%";
    }
  }

  function closeViewer() {
    if (!viewer) {
      return;
    }

    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");
    root.style.overflow = "";
  }

  function openViewer(trigger) {
    if (!viewer || !viewerImage || !viewerCaption) {
      return;
    }

    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");
    viewerImage.setAttribute("src", trigger.getAttribute("data-artifact-src") || "");
    viewerImage.setAttribute("alt", trigger.getAttribute("data-artifact-alt") || "");
    viewerCaption.textContent = trigger.getAttribute("data-artifact-caption") || "";
    zoom = 1;
    applyZoom();
    root.style.overflow = "hidden";
  }

  const stageWatch = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-stage-active", entry.isIntersecting);
      });
    },
    {
      rootMargin: "-18% 0px -48% 0px",
      threshold: 0.22,
    },
  );

  stageItems.forEach((item) => stageWatch.observe(item));

  const navWatch = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible && visible.target && visible.target.id) {
        markActive(visible.target.id);
      }
    },
    {
      rootMargin: "-18% 0px -56% 0px",
      threshold: [0.2, 0.4, 0.6],
    },
  );

  sectionItems.forEach((item) => navWatch.observe(item));

  copyButton?.addEventListener("click", (event) => {
    const raw = event.target;

    if (raw instanceof Element && raw.closest("a[href]")) {
      return;
    }

    event.preventDefault();
    const text = copyButton.getAttribute("data-copy-email") || "";
    void copyMail(text);
  });

  copyButton?.addEventListener("keydown", (event) => {
    const raw = event.target;

    if (raw instanceof Element && raw.closest("a[href]")) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    const text = copyButton.getAttribute("data-copy-email") || "";
    void copyMail(text);
  });

  artifactButtons.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      openViewer(item);
    });

    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openViewer(item);
    });
  });

  document.addEventListener("click", (event) => {
    const raw = event.target;

    if (!(raw instanceof Element)) {
      return;
    }

    const closeTrigger = raw.closest("[data-viewer-close]");

    if (closeTrigger) {
      event.preventDefault();
      closeViewer();
      return;
    }

    const zoomTrigger = raw.closest("[data-viewer-step]");

    if (zoomTrigger) {
      event.preventDefault();
      const step = zoomTrigger.getAttribute("data-viewer-step");
      zoom = step === "in" ? Math.min(2.5, zoom + 0.2) : Math.max(1, zoom - 0.2);
      applyZoom();
      return;
    }

    const artifactTrigger = raw.closest("[data-artifact-src]");

    if (artifactTrigger) {
      return;
    }

    const link = raw.closest('a[href^="#"]');

    if (!link) {
      return;
    }

    const href = link.getAttribute("href") || "";

    if (!href.startsWith("#")) {
      return;
    }

    const target = document.querySelector(href);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", href);

    if (link.getAttribute("data-spotlight") === "contact-email") {
      flashEmail();
      const text = copyButton?.getAttribute("data-copy-email") || "";
      if (text) {
        void copyMail(text);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    const raw = event.target;

    if (!(raw instanceof Element)) {
      return;
    }

    if (event.key === "Escape" && viewer && !viewer.hidden) {
      event.preventDefault();
      closeViewer();
      return;
    }

    if (!viewer.hidden && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      zoom = Math.min(2.5, zoom + 0.2);
      applyZoom();
      return;
    }

    if (!viewer.hidden && event.key === "-") {
      event.preventDefault();
      zoom = Math.max(1, zoom - 0.2);
      applyZoom();
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const artifactTrigger = raw.closest("[data-artifact-src]");

    if (artifactTrigger) {
      return;
    }

    const closeTrigger = raw.closest("[data-viewer-close]");

    if (closeTrigger) {
      event.preventDefault();
      closeViewer();
      return;
    }

    const zoomTrigger = raw.closest("[data-viewer-step]");

    if (!zoomTrigger) {
      return;
    }

    event.preventDefault();
    const step = zoomTrigger.getAttribute("data-viewer-step");
    zoom = step === "in" ? Math.min(2.5, zoom + 0.2) : Math.max(1, zoom - 0.2);
    applyZoom();
  });

  window.addEventListener("scroll", () => {
    setProgress();
    syncBrand();
    syncMobileHeroState();
  }, { passive: true });
  window.addEventListener("resize", () => {
    syncBrand();
    syncMobileHeroState();
  });
  setProgress();
  syncBrand();
  syncMobileHeroState();
  markActive("projects");
})();`;

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

function SocialIconLinks() {
  return (
    <>
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
      <a
        aria-label="Email"
        className="icon-link"
        data-spotlight="contact-email"
        href="#contact"
      >
        <MailIcon />
      </a>
    </>
  );
}

function HeroTextLinks() {
  return (
    <div className="hero-link-row" id="hero-links">
      <a
        className="hero-utility-link"
        href="https://github.com/fattah247"
        target="_blank"
        rel="noreferrer"
      >
        <GitHubIcon />
        GitHub
      </a>
      <a
        className="hero-utility-link"
        href="https://www.linkedin.com/in/muhammad24fattah/"
        target="_blank"
        rel="noreferrer"
      >
        <LinkedInIcon />
        LinkedIn
      </a>
      <a className="hero-utility-link" data-spotlight="contact-email" href="#contact">
        <MailIcon />
        Email
      </a>
    </div>
  );
}

function HeaderTextLinks() {
  return (
    <div className="header-link-row">
      <a
        className="header-utility-link"
        href="https://github.com/fattah247"
        target="_blank"
        rel="noreferrer"
      >
        <GitHubIcon />
        GitHub
      </a>
      <a
        className="header-utility-link"
        href="https://www.linkedin.com/in/muhammad24fattah/"
        target="_blank"
        rel="noreferrer"
      >
        <LinkedInIcon />
        LinkedIn
      </a>
      <a className="header-utility-link" data-spotlight="contact-email" href="#contact">
        <MailIcon />
        Email
      </a>
    </div>
  );
}

function HeroMarkField() {
  const marks = [
    { mark: "🌊", tone: "hero-mark-payflow", slot: "hero-mark-1" },
    { mark: "🛩️", tone: "hero-mark-iyup", slot: "hero-mark-2" },
    { mark: "🔒", tone: "hero-mark-trustgate", slot: "hero-mark-3" },
    { mark: "🌊", tone: "hero-mark-payflow", slot: "hero-mark-4" },
    { mark: "🛩️", tone: "hero-mark-iyup", slot: "hero-mark-5" },
    { mark: "🔒", tone: "hero-mark-trustgate", slot: "hero-mark-6" },
    { mark: "🌊", tone: "hero-mark-payflow", slot: "hero-mark-7" },
    { mark: "🛩️", tone: "hero-mark-iyup", slot: "hero-mark-8" },
    { mark: "🔒", tone: "hero-mark-trustgate", slot: "hero-mark-9" },
  ] as const;

  return (
    <div className="hero-mark-field" aria-hidden="true">
      {marks.map((item) => (
        <span
          key={`${item.mark}-${item.slot}`}
          className={`hero-mark ${item.tone} ${item.slot}`}
        >
          {item.mark}
        </span>
      ))}
    </div>
  );
}

function MobileNavPill() {
  return (
    <div className="mobile-nav-pill">
      <SocialIconLinks />
    </div>
  );
}

function ZoomIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mini-icon">
      <path
        fill="currentColor"
        d="M10.25 4.75a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Zm-7 5.5a7 7 0 1 1 12.03 4.9l4.06 4.07-1.06 1.06-4.07-4.06a7 7 0 0 1-10.96-5.97Zm6.25-2.5h1.5v1.75h1.75V11h-1.75v1.75H9.5V11H7.75V9.5H9.5V7.75Z"
      />
    </svg>
  );
}

function ArtifactCard({
  alt,
  caption,
  sizes,
  src,
  tall = false,
  tone,
  wide = false,
}: {
  alt: string;
  caption: string;
  sizes: string;
  src: string;
  tall?: boolean;
  tone: string;
  wide?: boolean;
}) {
  return (
    <button
      aria-label={`${caption} Click to expand image`}
      className="artifact"
      data-artifact-alt={alt}
      data-artifact-caption={caption}
      data-artifact-src={src}
      type="button"
    >
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
        <span className="artifact-link-mark" aria-hidden="true">
          <ZoomIcon />
        </span>
      </div>
    </button>
  );
}

export default function Home() {
  const email = "fattahmuhammad17@gmail.com";

  return (
    <div className="page-shell">
      <div id="scroll-progress" aria-hidden="true" />

      <header className="site-header">
        <div className="shell header-inner">
          <a
            aria-hidden="true"
            className="site-title hidden md:block"
            data-header-brand="true"
            href="#top"
            tabIndex={-1}
          >
            Muhammad A. Fattah
          </a>

          <div className="hidden items-center md:flex">
            <HeaderTextLinks />
          </div>

          <div className="mobile-nav-icons md:hidden">
            <MobileNavPill />
          </div>
        </div>
      </header>

      <div className="mobile-quick-links" aria-label="Quick links">
        <MobileNavPill />
      </div>

      <main id="top" className="shell">
        <section className="hero-section" data-stage="hero">
          <HeroMarkField />
          <div className="hero-layout">
            <div className="hero-copy-block">
              <h1 className="hero-name" id="hero-name">
                Muhammad
                <br className="hero-name-split" />
                A. Fattah
              </h1>
            </div>

            <aside className="hero-side">
              <p className="hero-line">
                <span>Payment systems.</span>
                <span className="hero-line-break">Android reliability.</span>
                <span className="hero-line-break">Backend observability.</span>
              </p>
              <p className="hero-copy">
                I build public labs around payment failures that are expensive
                to debug: unclear states, duplicate callbacks, weak
                visibility, and Android clients that trust too much.
              </p>

              <div className="hero-actions">
                <a className="action-link action-link-primary" href="#failures">
                  View labs
                </a>
              </div>

              <HeroTextLinks />
            </aside>
          </div>
        </section>

        <section
          id="failures"
          className="section-block section-block-compact failure-section"
        >
          <div className="section-top">
            <h2 className="section-title">Three failure cases</h2>
          </div>

          <p className="failure-lead">
            The work centers on payment state, service visibility, and device
            trust.
          </p>

          <div className="failure-list">
            <article className="failure-item">
              <h3>Readable payment state.</h3>
              <p>A transaction should not leave the system guessing what happened.</p>
            </article>
            <article className="failure-item">
              <h3>Monitoring that explains cause.</h3>
              <p>Monitoring is weak if it cannot explain what broke.</p>
            </article>
            <article className="failure-item">
              <h3>Android clients that challenge risk.</h3>
              <p>A payment client should know when to allow, warn, or block.</p>
            </article>
          </div>
        </section>

        <section id="projects" className="section-block" data-stage="projects">
          <div className="section-top">
            <h2 className="section-title">Selected labs</h2>
            <p className="section-intro">
              Three public labs, each testing one failure surface.
            </p>
          </div>

          <article
            className="project-stage project-stage-payflow"
            data-stage="payflow"
          >
            <div className="project-aside">
              <div className="project-head">
                <h3 className="project-title">PayFlow Reliability</h3>
                <p className="project-summary">
                  A Spring Boot lab for payment-like failure states: duplicate
                  callbacks, idempotency, settlement mismatch, and state
                  transitions.
                </p>
              </div>

              <div className="project-meta-block">
                <h4>Covers</h4>
                <ul className="project-points">
                  <li>Duplicate callbacks</li>
                  <li>Unclear transaction state</li>
                  <li>Settlement mismatch</li>
                  <li>Retry visibility</li>
                </ul>
              </div>

              <div className="project-proof-block">
                <h4>Visible behavior</h4>
                <ul className="project-proof-list">
                  <li>Duplicate callback detected</li>
                  <li>Existing transaction state reused</li>
                  <li>Settlement mismatch preserved</li>
                  <li>Retry path visible</li>
                </ul>
              </div>

              <div className="project-foot">
                <a
                  className="repo-link repo-link-payflow"
                  href="https://github.com/fattah247/payflow-reliability"
                  target="_blank"
                  rel="noreferrer"
                >
                  View repository
                  <ArrowOutIcon />
                </a>
                <p className="project-tech">
                  Spring Boot · PostgreSQL · Docker · REST API
                </p>
              </div>
            </div>

            <div className="project-main">
              <ArtifactCard
                src="/projects/payflow/audit-trail.png"
                alt="Audit trail output from PayFlow Reliability showing state transitions."
                caption="Duplicate callbacks are routed to the existing transaction state instead of creating a second transaction record."
                sizes="(max-width: 1024px) 100vw, 58vw"
                tone="bg-[#0f1823]"
                wide
              />

              <div className="project-detail-grid project-detail-grid-payflow project-evidence-secondary">
                <div className="project-panel project-panel-secondary">
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

                <ArtifactCard
                  src="/projects/payflow/duplicate-webhook.png"
                  alt="Duplicate provider webhook handled and ignored in PayFlow Reliability."
                  caption="Duplicate callbacks show up as handled behavior, not as a hidden assumption."
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  tone="bg-[#0f1823]"
                  wide
                />
              </div>
            </div>
          </article>

          <article
            className="project-stage project-stage-iyup"
            data-stage="iyup"
          >
            <div className="project-aside">
              <div className="project-head">
                <h3 className="project-title">iYup</h3>
                <p className="project-summary">
                  An observability lab for service health, latency, alert
                  state, and dashboard visibility.
                </p>
              </div>

              <div className="project-meta-block">
                <h4>Covers</h4>
                <ul className="project-points">
                  <li>Service health</li>
                  <li>Latency visibility</li>
                  <li>Alert conditions</li>
                  <li>Operational dashboarding</li>
                </ul>
              </div>

              <div className="project-proof-block">
                <h4>Visible behavior</h4>
                <ul className="project-proof-list">
                  <li>Service health</li>
                  <li>Latency</li>
                  <li>Alert state</li>
                  <li>Dashboard visibility</li>
                </ul>
              </div>

              <div className="project-foot">
                <a
                  className="repo-link repo-link-iyup"
                  href="https://github.com/fattah247/iYup"
                  target="_blank"
                  rel="noreferrer"
                >
                  View repository
                  <ArrowOutIcon />
                </a>
                <p className="project-tech">
                  Prometheus · Grafana · Alertmanager · Go
                </p>
              </div>
            </div>

            <div className="project-main">
              <ArtifactCard
                src="/projects/iyup/grafana-dashboard.png"
                alt="Grafana dashboard from iYup showing service health and latency metrics."
                caption="Grafana shows service health, latency, and alert state in one view."
                sizes="(max-width: 1024px) 100vw, 58vw"
                tone="bg-[#101412]"
                wide
              />

              <div className="project-detail-grid project-detail-grid-iyup project-evidence-secondary">
                <div className="project-panel project-panel-secondary">
                  <h4>Signals</h4>
                  <div className="signal-cards">
                    {[
                      ["Health checks", "Status API"],
                      ["Latency", "Prometheus / Grafana"],
                      ["Alerts", "Alertmanager"],
                    ].map(([signal, surface]) => (
                      <article className="signal-card" key={signal}>
                        <h5>{signal}</h5>
                        <p>Source: {surface}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <ArtifactCard
                  src="/projects/iyup/prometheus-targets.png"
                  alt="Prometheus targets page from iYup showing scrape state for monitored services."
                  caption="Target scraping is visible at the collection boundary."
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  tone="bg-[#101412]"
                  wide
                />
              </div>
            </div>
          </article>

          <article
            className="project-stage project-stage-trustgate"
            data-stage="trustgate"
          >
            <div className="project-aside">
              <div className="project-head">
                <h3 className="project-title">TrustGate Android</h3>
                <p className="project-summary">
                  An Android client-trust lab for deciding when a device should
                  be allowed, warned, or blocked.
                </p>
              </div>

              <div className="project-meta-block">
                <h4>Covers</h4>
                <ul className="project-points">
                  <li>Device risk state</li>
                  <li>Root and emulator signals</li>
                  <li>Sensitive action protection</li>
                  <li>Security event visibility</li>
                </ul>
              </div>

              <div className="project-proof-block">
                <h4>Visible behavior</h4>
                <ul className="project-proof-list">
                  <li>Device risk state</li>
                  <li>Security event log</li>
                  <li>Sensitive action blocked</li>
                  <li>Risk-based decision path</li>
                </ul>
              </div>

              <div className="project-foot">
                <a
                  className="repo-link repo-link-trustgate"
                  href="https://github.com/fattah247/trustgate-android"
                  target="_blank"
                  rel="noreferrer"
                >
                  View repository
                  <ArrowOutIcon />
                </a>
                <p className="project-tech">
                  Kotlin · Android · Jetpack Compose · Jetpack Security
                </p>
              </div>
            </div>

            <div className="project-main">
              <div className="phone-grid">
                <ArtifactCard
                  src="/projects/trustgate/device-risk-details.png"
                  alt="Device risk details screen from TrustGate Android showing risk signals."
                  caption="Risk state is visible before sensitive actions are allowed."
                  sizes="(max-width: 1024px) 100vw, 28vw"
                  tone="bg-[#d7dce5]"
                  tall
                />

                <div className="project-evidence-secondary">
                  <ArtifactCard
                  src="/projects/trustgate/security-event-log.png"
                  alt="Security event log screen from TrustGate Android."
                  caption="Blocked or gated behavior leaves a readable local trail."
                  sizes="(max-width: 1024px) 100vw, 28vw"
                  tone="bg-[#d7dce5]"
                  tall
                />
                </div>
              </div>

              <div className="decision-strip">
                <div>
                  <span>Low risk</span>
                  <p>Action: allow</p>
                </div>
                <div>
                  <span>Medium risk</span>
                  <p>Action: require confirmation</p>
                </div>
                <div>
                  <span>High risk</span>
                  <p>Action: block</p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section
          className="section-block section-block-compact"
          data-stage="current"
        >
          <div className="section-top">
            <h2 className="section-title">Current work</h2>
          </div>

          <div className="current-grid">
            <article>
              <h3>Android payments</h3>
              <p>
                Merchant-facing payment flows, transaction states, and
                app-to-service integration.
              </p>
            </article>

            <article>
              <h3>Backend delivery</h3>
              <p>
                Transaction status handling, API integration, and service
                reliability.
              </p>
            </article>

            <article>
              <h3>iOS support</h3>
              <p>
                Order creation, phone-based payment flows, and merchant
                features.
              </p>
            </article>
          </div>
        </section>

        <section id="stack" className="section-block section-block-compact" data-stage="stack">
          <div className="section-top">
            <h2 className="section-title">Stack</h2>
            <p className="section-intro">
              Mobile, backend, platform, security, and incident work behind the labs.
            </p>
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
            <p className="section-intro">
              Engineering conversations around payment systems, Android
              reliability, backend observability, and client trust.
            </p>
          </div>

          <div
            aria-label={`Copy ${email}`}
            className="copy-email-shell"
            data-copy-email={email}
            id="contact-email"
            role="button"
            tabIndex={0}
          >
            <span className="copy-email-link">
              {email}
            </span>
            <span className="copy-email-hint">Click to copy</span>
            <span className="copy-toast" data-copy-toast="true" hidden>
              Email copied
            </span>
          </div>

          <div className="contact-links">
            <a
              className="contact-pill-link"
              href="https://github.com/fattah247"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              className="contact-pill-link"
              href="https://www.linkedin.com/in/muhammad24fattah/"
              target="_blank"
              rel="noreferrer"
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          </div>
        </section>
      </main>

      <div
        aria-hidden="true"
        aria-modal="true"
        className="viewer-shell"
        data-viewer-root="true"
        hidden
        role="dialog"
      >
        <button
          aria-label="Close image viewer"
          className="viewer-veil"
          data-viewer-close="true"
          type="button"
        />

        <div className="viewer-card">
          <div className="viewer-head">
            <p className="viewer-kicker">Artifact view</p>
            <button
              className="viewer-tool viewer-tool-close"
              data-viewer-close="true"
              type="button"
            >
              Close
            </button>
          </div>

          <div className="viewer-stage">
            <div className="viewer-media" data-viewer-media="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="viewer-image"
                data-viewer-image="true"
                src=""
              />
            </div>
          </div>

          <div className="viewer-lower">
            <p className="viewer-caption" data-viewer-caption="true" />

            <div className="viewer-tools">
              <span className="viewer-scale" data-viewer-scale="true">
                100%
              </span>
              <button
                aria-label="Zoom out"
                className="viewer-tool"
                data-viewer-step="out"
                type="button"
              >
                -
              </button>
              <button
                aria-label="Zoom in"
                className="viewer-tool"
                data-viewer-step="in"
                type="button"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: interactionScript }} />
    </div>
  );
}
