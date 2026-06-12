import Image from "next/image";
import Script from "next/script";

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

const heroProofMap = [
  ["BCA", "Android POS + payment reliability"],
  ["PayFlow", "callbacks + reconciliation lab"],
  ["iYup", "health + latency visibility"],
  ["TrustGate", "device risk decisions"],
] as const;

const githubProofRepos = [
  {
    name: "SnapSort-iOS",
    focus: "iOS photo management",
    href: "https://github.com/fattah247/SnapSort-iOS",
  },
  {
    name: "Stock-Triage",
    focus: "IDX filing automation",
    href: "https://github.com/fattah247/Stock-Triage",
  },
  {
    name: "Xpire",
    focus: "expiration reminders",
    href: "https://github.com/fattah247/Xpire",
  },
  {
    name: "IoTifyHome",
    focus: "smart-home control",
    href: "https://github.com/fattah247/IoTifyHome",
  },
] as const;

const heroMarks = ["flow", "secure", "observe", "recover", "ship", "audit"] as const;

const transparentPixel =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const projectMarks = {
  payflow: ["intent", "webhook", "reconcile", "audit"],
  iyup: ["health", "latency", "alerts", "dashboard"],
  trustgate: ["device", "risk", "gate", "event"],
} as const;

const failureCases = [
  {
    title: "Readable payment state",
    description:
      "Retries, callbacks, and settlement edges should leave a readable trail instead of sending operators into guesswork.",
    canDo: ["callback recovery", "status reconciliation", "stuck-flow repair"],
  },
  {
    title: "Monitoring that explains cause",
    description:
      "Health, latency, and alerting should explain why a path failed, not just confirm that it moved.",
    canDo: ["health checks", "latency signals", "alert wiring"],
  },
  {
    title: "Android clients that challenge risk",
    description:
      "Client trust needs visible risk signals, gated actions, and mobile hardening that survives real-world devices.",
    canDo: ["risk signals", "secure flows", "gated actions"],
  },
] as const;

const careerProgression = [
  {
    company: "Bank Central Asia",
    short: "BCA",
    role: "Software Engineer / IT Specialist",
    period: "Sep 2023 - Present",
    location: "Indonesia",
    logo: "/logos/bca.png",
    summary:
      "Android POS and merchant payment reliability at national scale.",
    bullets: [
      "Build Android payment integrations with Kotlin, Java, AIDL, REST APIs, and WebSocket.",
      "Improve callback recovery, transaction-state handling, and failure-path repair.",
      "Handle production incidents from debugging through rollback or hardening.",
      "Support early iOS merchant work and secure Android delivery.",
    ],
  },
  {
    company: "Telkom Indonesia",
    short: "Telkom",
    role: "iOS Engineer Intern",
    period: "Apr 2023 - Sep 2023",
    location: "Bandung, Indonesia",
    logo: "/logos/telkom.png",
    summary:
      "Reusable SwiftUI components and pattern systems for government-facing apps.",
    bullets: [
      "Built reusable SwiftUI components for consistent multi-project delivery.",
      "Documented repeated layouts and interaction patterns for reuse.",
      "Improved integration quality and maintainability with the team.",
    ],
  },
  {
    company: "Apple Developer Academy",
    short: "ADA",
    role: "iOS Developer",
    period: "Feb 2022 - Dec 2022",
    location: "Indonesia",
    logo: "/logos/apple.png",
    summary:
      "Cross-functional iOS prototypes from discovery to demo-ready release.",
    bullets: [
      "Built four SwiftUI prototypes across health-tech, reading support, reflection, and relationship use cases.",
      "Led implementation decisions with design, business, and product teammates.",
      "Worked through discovery, prototyping, testing, and demo-ready iteration.",
      "Used reusable components, local data, and accessibility basics.",
    ],
  },
] as const;

const stageMenuItems = [
  { id: "top", label: "Introduction" },
  { id: "failures", label: "What I fix" },
  { id: "projects", label: "Selected labs" },
  { id: "more-projects", label: "More on GitHub" },
  { id: "current-work", label: "Experience" },
  { id: "stack", label: "Stack" },
  { id: "contact", label: "Contact" },
] as const;

const interactionScript = String.raw`(() => {
  if (window.__fattahSiteReady) {
    return;
  }

  window.__fattahSiteReady = true;

  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileMedia = window.matchMedia("(max-width: 767px)");
  const brand = document.querySelector("[data-header-brand-link]");
  const stageToggle = document.querySelector("[data-stage-toggle]");
  const stageCurrent = document.querySelector("[data-stage-current]");
  const stageMenu = document.querySelector("[data-stage-menu]");
  const stageControl = document.querySelector("[data-stage-control]");
  const hero = document.getElementById("hero-name");
  const heroLinks = document.getElementById("hero-links");
  const progress = document.getElementById("scroll-progress");
  const emailShell = document.getElementById("contact-email");
  const contactSection = document.getElementById("contact");
  const githubMoreSection = document.getElementById("more-projects");
  const contactLinks = document.querySelector("[data-contact-links]");
  const toast = document.querySelector("[data-copy-toast]");
  const viewer = document.querySelector("[data-viewer-root]");
  const viewerImage = document.querySelector("[data-viewer-image]");
  const viewerCaption = document.querySelector("[data-viewer-caption]");
  const viewerStage = document.querySelector("[data-viewer-stage]");
  const viewerMedia = document.querySelector("[data-viewer-media]");
  const viewerScale = document.querySelector("[data-viewer-scale]");
  const stageItems = Array.from(document.querySelectorAll("[data-stage]"));
  const navStages = Array.from(document.querySelectorAll("[data-stage-nav='true']"));
  const projectStages = Array.from(document.querySelectorAll(".project-stage"));
  const copyButton = document.querySelector("[data-copy-email]");
  const artifactButtons = Array.from(document.querySelectorAll("[data-artifact-src]"));
  const finePointerMedia = window.matchMedia("(hover: hover) and (pointer: fine)");

  let flashTimer = 0;
  let toastTimer = 0;
  let zoom = 1;
  let sectionFlashTimer = 0;
  let activeStage = "";
  let pillMode = "all";
  let pillStateInitialized = false;
  let pillModeTimer = 0;
  let mobileFloating = false;
  let pillMotionTimer = 0;
  let lastScrollY = window.scrollY;
  let panX = 0;
  let panY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let dragging = false;
  let scrollTicking = false;

  root.setAttribute("data-interact-ready", "yes");

function setBrand(visible) {
  if (!brand) {
    return;
  }

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
    root.classList.add("desk-hero-away");
    setBrand(true);
    return;
  }

  const heroRect = hero.getBoundingClientRect();
  const showBrand = heroRect.bottom <= 76;
  root.classList.toggle("desk-hero-away", showBrand);
  setBrand(showBrand);
}

  function announceStage(stageLabel) {
    if (!stageCurrent || !stageControl || mobileMedia.matches || !stageLabel) {
      return;
    }

    stageCurrent.textContent = stageLabel;
    stageControl.classList.remove("is-pulsing");
    void stageControl.offsetWidth;
    stageControl.classList.add("is-pulsing");
    window.clearTimeout(sectionFlashTimer);
    sectionFlashTimer = window.setTimeout(() => {
      stageControl.classList.remove("is-pulsing");
    }, 280);
  }

  function setProgress() {
    if (!progress) {
      return;
    }

    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct = total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0;
    progress.style.width = pct + "%";
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
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
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
          emailShell?.classList.add("copy-email-shell-copied");
          window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => {
            emailShell?.classList.remove("copy-email-shell-copied");
          }, 1800);
        }
        return;
      }
      showToast();
    } catch {
      if (toast) {
        toast.textContent = "Copy failed";
        emailShell?.classList.add("copy-email-shell-copied");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
          emailShell?.classList.remove("copy-email-shell-copied");
        }, 1800);
      }
    }
  }

  function clampPan(nextX, nextY) {
    if (!viewerStage || !viewerMedia || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const stageWidth = viewerStage.clientWidth;
    const stageHeight = viewerStage.clientHeight;
    const mediaWidth = viewerMedia.clientWidth;
    const mediaHeight = viewerMedia.clientHeight;
    const limitX = Math.max(0, ((mediaWidth * zoom) - stageWidth) / 2);
    const limitY = Math.max(0, ((mediaHeight * zoom) - stageHeight) / 2);

    return {
      x: Math.min(limitX, Math.max(-limitX, nextX)),
      y: Math.min(limitY, Math.max(-limitY, nextY)),
    };
  }

  function applyZoom() {
    if (!viewerMedia) {
      return;
    }

    const clamped = clampPan(panX, panY);
    panX = clamped.x;
    panY = clamped.y;
    viewerMedia.style.transform =
      "translate3d(" + panX + "px, " + panY + "px, 0) scale(" + zoom + ")";
    viewerMedia.classList.toggle("is-draggable", zoom > 1);

    if (viewerScale) {
      viewerScale.textContent = Math.round(zoom * 100) + "%";
    }
  }

  function closeViewer() {
    if (!viewer) {
      return;
    }

    dragging = false;
    panX = 0;
    panY = 0;
    viewerMedia?.classList.remove("is-dragging");
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
    viewerImage.setAttribute("src", trigger.getAttribute("data-artifact-src") || "${transparentPixel}");
    viewerImage.setAttribute("alt", trigger.getAttribute("data-artifact-alt") || "");
    viewerCaption.textContent = trigger.getAttribute("data-artifact-caption") || "";
    zoom = 1;
    panX = 0;
    panY = 0;
    applyZoom();
    root.style.overflow = "hidden";
  }

  function syncActiveStage() {
    if (!navStages.length) {
      return;
    }

    const anchor = window.innerHeight * (mobileMedia.matches ? 0.18 : 0.24);
    let best = "";
    let bestDistance = Number.POSITIVE_INFINITY;

    navStages.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return;
      }

      const focus = rect.top + (rect.height * 0.34);
      const distance = Math.abs(focus - anchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item.getAttribute("data-stage-label") || "";
      }
    });

    if (best && best !== activeStage) {
      activeStage = best;
      announceStage(best);
    }
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

  const revealWatch = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-materialized");
        revealWatch.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -14% 0px",
      threshold: 0.16,
    },
  );

  stageItems.forEach((item) => revealWatch.observe(item));

  function materializeVisibleStages() {
    stageItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight * 0.94) {
        return;
      }

      item.classList.add("is-materialized");
      revealWatch.unobserve(item);
    });
  }

  function syncMobilePill() {
    if (!heroLinks) {
      root.classList.remove("mobile-links-away");
      root.classList.remove("mobile-pill-mode-github");
      root.classList.remove("mobile-pill-mode-social");
      root.classList.remove("mobile-pill-rising");
      root.classList.remove("mobile-pill-retreating");
      pillStateInitialized = false;
      return;
    }

    if (!mobileMedia.matches) {
      root.classList.remove("mobile-links-away");
      root.classList.remove("mobile-pill-mode-github");
      root.classList.remove("mobile-pill-mode-social");
      root.classList.remove("mobile-pill-rising");
      root.classList.remove("mobile-pill-retreating");
      mobileFloating = false;
      pillStateInitialized = false;
      return;
    }

    const rect = heroLinks.getBoundingClientRect();
    const currentScrollY = window.scrollY;
    const scrollingDown = currentScrollY > lastScrollY;
    const showThreshold = 248;
    const hideThreshold = 304;
    const shouldFloat = mobileFloating
      ? rect.top <= hideThreshold
      : rect.top <= showThreshold;
    const contactRect = contactSection ? contactSection.getBoundingClientRect() : null;
    const contactVisible =
      !!contactRect &&
      contactRect.top < window.innerHeight * 0.72 &&
      contactRect.bottom > window.innerHeight * 0.18;
    const githubRect = githubMoreSection ? githubMoreSection.getBoundingClientRect() : null;
    const githubVisible =
      !!githubRect &&
      githubRect.top < window.innerHeight * 0.85 &&
      githubRect.bottom > window.innerHeight * 0.22;
    const nextMode = contactVisible ? "github" : githubVisible ? "social" : "all";
    if (!pillStateInitialized) {
      mobileFloating = shouldFloat;
      pillMode = nextMode;
      pillStateInitialized = true;
      root.classList.toggle("mobile-links-away", shouldFloat);
      root.classList.toggle("mobile-pill-mode-github", contactVisible);
      root.classList.toggle("mobile-pill-mode-social", !contactVisible && githubVisible);
      root.classList.remove("mobile-pill-rising");
      root.classList.remove("mobile-pill-retreating");
      root.classList.remove("mobile-pill-settling");
      lastScrollY = currentScrollY;
      return;
    }

    if (shouldFloat !== mobileFloating) {
      mobileFloating = shouldFloat;
      root.classList.remove("mobile-pill-rising");
      root.classList.remove("mobile-pill-retreating");
      root.classList.toggle("mobile-links-away", shouldFloat);
      if (shouldFloat && scrollingDown) {
        root.classList.add("mobile-pill-rising");
      } else if (!shouldFloat && !scrollingDown) {
        root.classList.add("mobile-pill-retreating");
      }
      window.clearTimeout(pillMotionTimer);
      pillMotionTimer = window.setTimeout(() => {
        root.classList.remove("mobile-pill-rising");
        root.classList.remove("mobile-pill-retreating");
      }, shouldFloat ? 420 : 300);
    }

    if (!shouldFloat) {
      root.classList.remove("mobile-pill-settling");
      window.clearTimeout(pillModeTimer);
      pillMode = nextMode;
      root.classList.toggle("mobile-pill-mode-github", contactVisible);
      root.classList.toggle("mobile-pill-mode-social", !contactVisible && githubVisible);
      lastScrollY = currentScrollY;
      return;
    }

    if (nextMode !== pillMode) {
      root.classList.remove("mobile-pill-rising");
      root.classList.remove("mobile-pill-retreating");
      root.classList.add("mobile-pill-settling");
      window.clearTimeout(pillModeTimer);
      pillModeTimer = window.setTimeout(() => {
        root.classList.remove("mobile-pill-settling");
      }, 280);
    }

    root.classList.toggle("mobile-pill-mode-github", contactVisible);
    root.classList.toggle("mobile-pill-mode-social", !contactVisible && githubVisible);
    pillMode = nextMode;
    lastScrollY = currentScrollY;
  }

  function setStageSpot(stage, clientX, clientY) {
    if (!(stage instanceof HTMLElement)) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    stage.style.setProperty("--spot-x", (clientX - rect.left) + "px");
    stage.style.setProperty("--spot-y", (clientY - rect.top) + "px");
  }

  function settleStageSpotOnLink(link) {
    const stage = link.closest(".project-stage");
    if (!(stage instanceof HTMLElement)) {
      return;
    }

    const linkRect = link.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    stage.style.setProperty("--spot-x", (linkRect.left - stageRect.left + (linkRect.width / 2)) + "px");
    stage.style.setProperty("--spot-y", (linkRect.top - stageRect.top + (linkRect.height / 2)) + "px");
    stage.classList.add("is-pointer-active");
  }

  function closeStageMenu() {
    if (!(stageControl instanceof Element) || !(stageToggle instanceof Element)) {
      return;
    }

    stageControl.classList.remove("is-open");
    stageToggle.setAttribute("aria-expanded", "false");
  }

  function openStageMenu() {
    if (!(stageControl instanceof Element) || !(stageToggle instanceof Element)) {
      return;
    }

    stageControl.classList.add("is-open");
    stageToggle.setAttribute("aria-expanded", "true");
  }

  function toggleStageMenu() {
    if (!(stageControl instanceof Element)) {
      return;
    }

    if (stageControl.classList.contains("is-open")) {
      closeStageMenu();
      return;
    }

    openStageMenu();
  }

  stageToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleStageMenu();
  });

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

  projectStages.forEach((stage) => {
    stage.addEventListener("pointerenter", (event) => {
      if (!finePointerMedia.matches) {
        return;
      }

      setStageSpot(stage, event.clientX, event.clientY);
      stage.classList.add("is-pointer-active");
    });

    stage.addEventListener("pointermove", (event) => {
      if (!finePointerMedia.matches) {
        return;
      }

      setStageSpot(stage, event.clientX, event.clientY);
    });

    stage.addEventListener("pointerleave", () => {
      stage.classList.remove("is-pointer-active");
    });
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !(stageControl instanceof Element)) {
      return;
    }

    if (!stageControl.contains(event.target)) {
      closeStageMenu();
    }
  });

  document.addEventListener("click", (event) => {
    const raw = event.target;

    if (!(raw instanceof Element)) {
      return;
    }

    const repoTrigger = raw.closest(".repo-link, .action-link[href^='https://github.com/']");

    if (repoTrigger instanceof HTMLAnchorElement) {
      settleStageSpotOnLink(repoTrigger);
    }

    const scrollTrigger = raw.closest("[data-scroll-target]");

    if (!scrollTrigger) {
      return;
    }

    event.preventDefault();
    const targetId = scrollTrigger.getAttribute("data-scroll-target");
    const target = targetId ? document.getElementById(targetId) : null;

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", "#" + target.id);
    closeStageMenu();
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
      if (zoom === 1) {
        panX = 0;
        panY = 0;
      }
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

    if (event.key === "Escape") {
      closeStageMenu();
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
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    }
    applyZoom();
  });

  viewerStage?.addEventListener("pointerdown", (event) => {
    if (zoom <= 1 || !(event.target instanceof Element) || !event.target.closest("[data-viewer-media]")) {
      return;
    }

    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = panX;
    dragOriginY = panY;
    viewerMedia?.classList.add("is-dragging");
    viewerStage.setPointerCapture(event.pointerId);
  });

  viewerStage?.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }

    const clamped = clampPan(
      dragOriginX + (event.clientX - dragStartX),
      dragOriginY + (event.clientY - dragStartY),
    );
    panX = clamped.x;
    panY = clamped.y;
    applyZoom();
  });

  function stopDragging(pointerId) {
    if (!dragging) {
      return;
    }

    dragging = false;
    viewerMedia?.classList.remove("is-dragging");
    if (viewerStage && typeof pointerId === "number") {
      try {
        viewerStage.releasePointerCapture(pointerId);
      } catch {}
    }
  }

  viewerStage?.addEventListener("pointerup", (event) => stopDragging(event.pointerId));
  viewerStage?.addEventListener("pointercancel", (event) => stopDragging(event.pointerId));

  function update() {
    setProgress();
    syncBrand();
    syncMobilePill();
    syncActiveStage();
    materializeVisibleStages();
    if (mobileMedia.matches) {
      closeStageMenu();
    }
  }

  function queueUpdate() {
    if (scrollTicking) {
      return;
    }

    scrollTicking = true;
    window.requestAnimationFrame(() => {
      scrollTicking = false;
      update();
    });
  }

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  window.addEventListener("hashchange", queueUpdate);
  update();
  window.requestAnimationFrame(update);
  window.setTimeout(update, 160);
  window.setTimeout(update, 420);
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

function HeroTextLinks() {
  return (
    <div className="hero-link-row" id="hero-links">
      <a
        className="hero-utility-link"
        data-hero-kind="github"
        href="https://github.com/fattah247"
        target="_blank"
        rel="noreferrer"
      >
        <GitHubIcon />
        <span className="hero-link-label">GitHub</span>
      </a>
      <a
        className="hero-utility-link"
        data-hero-kind="linkedin"
        href="https://www.linkedin.com/in/muhammad24fattah/"
        target="_blank"
        rel="noreferrer"
      >
        <LinkedInIcon />
        <span className="hero-link-label">LinkedIn</span>
      </a>
      <a className="hero-utility-link" data-hero-kind="mail" data-spotlight="contact-email" href="#contact">
        <MailIcon />
        <span className="hero-link-label">Email</span>
      </a>
    </div>
  );
}

function HeaderUtilityLinks() {
  return (
    <div className="header-link-row" data-header-row="true">
      <div className="header-left-cluster">
        <a aria-hidden="true" className="header-brand-link" data-header-brand-link="true" href="#top" tabIndex={-1}>
          Muhammad A. Fattah
        </a>
        <div className="header-utility-group">
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
      </div>

      <div className="header-stage-control" data-stage-control="true">
        <button
          aria-expanded="false"
          aria-haspopup="true"
          className="header-stage-button"
          data-stage-toggle="true"
          type="button"
        >
          <span className="header-stage-kicker">Section</span>
          <span className="header-stage-current" data-stage-current="true">
            Introduction
          </span>
        </button>

        <div className="header-stage-menu" data-stage-menu="true">
          {stageMenuItems.map((item) => (
            <button
              key={item.id}
              className="header-stage-item"
              data-scroll-target={item.id}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileQuickLinks() {
  return (
    <div className="mobile-quick-links" data-mobile-pill="true">
      <a
        aria-label="GitHub"
        className="icon-link"
        data-pill-kind="github"
        href="https://github.com/fattah247"
        rel="noreferrer"
        target="_blank"
      >
        <GitHubIcon />
      </a>
      <a
        aria-label="LinkedIn"
        className="icon-link"
        data-pill-kind="linkedin"
        href="https://www.linkedin.com/in/muhammad24fattah/"
        rel="noreferrer"
        target="_blank"
      >
        <LinkedInIcon />
      </a>
      <a
        aria-label="Email"
        className="icon-link"
        data-pill-kind="mail"
        data-spotlight="contact-email"
        href="#contact"
      >
        <MailIcon />
      </a>
    </div>
  );
}

function HeroBackdropMarks() {
  return (
    <div className="hero-marks" aria-hidden="true">
      {heroMarks.map((item) => (
        <span key={item} className="hero-mark">
          {item}
        </span>
      ))}
    </div>
  );
}

function ProjectBackdropMarks({
  marks,
}: {
  marks: ReadonlyArray<string>;
}) {
  return (
    <div className="project-marks" aria-hidden="true">
      {marks.map((item) => (
        <span key={item} className="project-mark">
          {item}
        </span>
      ))}
    </div>
  );
}

function HeroProofMap() {
  return (
    <div className="hero-proof-map" aria-label="Work map">
      {heroProofMap.map(([label, detail]) => (
        <div className="hero-proof-node" key={label}>
          <span>{label}</span>
          <p>{detail}</p>
        </div>
      ))}
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
  pageCaption,
  priority = false,
  sizes,
  src,
  tall = false,
  tone,
  wide = false,
}: {
  alt: string;
  caption: string;
  pageCaption?: string;
  priority?: boolean;
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
          priority={priority}
          sizes={sizes}
          unoptimized
        />
      </div>
      <div className="artifact-meta">
        {pageCaption !== "" ? (
          <p className="artifact-caption-text">{pageCaption ?? caption}</p>
        ) : null}
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
          <div className="hidden items-center md:flex">
            <HeaderUtilityLinks />
          </div>

          <div className="mobile-nav-icons md:hidden" data-mobile-pill-dock="true">
            <MobileQuickLinks />
          </div>
        </div>
      </header>

      <main className="shell">
        <section
          id="top"
          className="hero-section"
          data-stage="hero"
          data-stage-nav="true"
          data-stage-label="Introduction"
        >
          <HeroBackdropMarks />
          <div className="hero-layout">
            <div className="hero-copy-block">
              <h1 className="hero-name" id="hero-name">
                <span className="block">Muhammad</span>
                <span className="block">A. Fattah</span>
              </h1>
              <p className="hero-role">
                Software Engineer | Payment Reliability • Secure Android • Observability
              </p>
            </div>

            <aside className="hero-side">
              <p className="hero-line">
                <span>Production payment systems.</span>
                <span className="hero-line-break">Secure Android delivery.</span>
                <span className="hero-line-break">Signals that hold under pressure.</span>
              </p>
              <p className="hero-copy">
                I build merchant-facing payment software, work through
                production incidents, and tighten the failure paths that matter
                when money, devices, and timing all get messy.
              </p>
              <ul className="hero-focus-list">
                <li>Android POS delivery and merchant integrations</li>
                <li>Incident response, rollback coordination, and hardening</li>
                <li>iOS foundations, backend coordination, and release work</li>
              </ul>

              <HeroProofMap />

              <div className="hero-actions">
                <button
                  className="action-link action-link-primary"
                  data-scroll-target="projects"
                  type="button"
                >
                  View labs
                </button>
              </div>

              <HeroTextLinks />
              <div className="hero-pill-trigger" data-mobile-pill-trigger="true" aria-hidden="true" />
            </aside>
          </div>
        </section>

        <section
          id="failures"
          className="section-block section-block-compact failure-section"
          data-stage="failures"
          data-stage-nav="true"
          data-stage-label="What I fix"
        >
          <div className="section-top">
            <h2 className="section-title">Three failure cases</h2>
            <p className="section-intro">
              The problems I usually get pulled into, and the recovery paths I
              build around them.
            </p>
          </div>

          <div className="failure-list">
            {failureCases.map((item) => (
              <article className="failure-item" key={item.title}>
                <h3>{item.title}.</h3>
                <p>{item.description}</p>
                <ul className="failure-capability-list">
                  {item.canDo.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          id="projects"
          className="section-block"
          data-stage="projects"
          data-stage-nav="true"
          data-stage-label="Selected labs"
        >
          <div className="section-top">
            <h2 className="section-title">Selected labs</h2>
            <p className="section-intro">
              Three public labs, each testing one failure surface.
            </p>
          </div>

          <article
            className="project-stage project-stage-payflow"
            data-stage="payflow"
            data-stage-label="PayFlow Reliability"
          >
            <ProjectBackdropMarks marks={projectMarks.payflow} />
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
                priority
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
            data-stage-label="iYup"
          >
            <ProjectBackdropMarks marks={projectMarks.iyup} />
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
            data-stage-label="TrustGate Android"
          >
            <ProjectBackdropMarks marks={projectMarks.trustgate} />
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
          id="more-projects"
          className="section-block section-block-compact"
          data-stage="github-more"
          data-stage-nav="true"
          data-stage-label="More on GitHub"
        >
          <div className="section-top">
            <h2 className="section-title">More on GitHub</h2>
            <p className="section-intro">
              The homepage is the shortlist. GitHub is the fuller record.
            </p>
          </div>

          <div className="github-stage">
            <div className="github-stage-copy">
              <p className="github-stage-lead">
                It is the better place to judge range: public labs, smaller
                builds, setup clarity, screenshots, and the way the code is
                carried in public.
              </p>
              <ul className="github-stage-points">
                <li>Payment and reliability labs with runnable setup and captured output</li>
                <li>Smaller repos that show range, not just polished showcases</li>
                <li>A clearer read on how I structure, debug, and document work</li>
              </ul>
              <div className="github-proof-strip" aria-label="Additional public repositories">
                {githubProofRepos.map((repo) => (
                  <a
                    className="github-proof-item"
                    href={repo.href}
                    key={repo.name}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{repo.name}</span>
                    <p>{repo.focus}</p>
                  </a>
                ))}
              </div>
              <a
                className="action-link"
                href="https://github.com/fattah247"
                target="_blank"
                rel="noreferrer"
              >
                Open GitHub profile
                <ArrowOutIcon />
              </a>
            </div>

            <ArtifactCard
              src="/projects/github-profile.png"
              alt="GitHub profile screenshot for Muhammad A. Fattah."
              caption="The profile shows the wider body of work behind the featured labs: smaller builds, public proof, and the way the code is carried in public."
              pageCaption=""
              sizes="(max-width: 1024px) 100vw, 58vw"
              tone="bg-[#0c1117]"
              wide
            />
          </div>
        </section>

        <section
          id="current-work"
          className="section-block section-block-compact"
          data-stage="current"
          data-stage-nav="true"
          data-stage-label="Experience"
        >
          <div className="section-top">
            <h2 className="section-title">Experience</h2>
            <p className="section-intro">
              Production payment systems, early iOS delivery, and the path that
              got me there.
            </p>
          </div>

          <div className="career-timeline">
            <div className="career-grid">
              {careerProgression.map((item) => (
                <article className="career-item" key={item.company}>
                  <div className="career-mark">
                    <div className="career-logo-shell">
                      <Image
                        src={item.logo}
                        alt={`${item.company} logo`}
                        width={44}
                        height={44}
                        className="career-logo-image"
                        unoptimized
                      />
                    </div>
                  </div>

                  <div className="career-copy">
                    <p className="career-period">{item.period}</p>
                    <h3>{item.role}</h3>
                    <p className="career-company">
                      {item.company} · {item.location}
                    </p>
                    <p className="career-summary">{item.summary}</p>
                    <ul className="career-points">
                      {item.bullets.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="stack"
          className="section-block section-block-compact"
          data-stage="stack"
          data-stage-nav="true"
          data-stage-label="Stack"
        >
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

        <section
          id="contact"
          className="section-block section-block-compact"
          data-stage="contact"
          data-stage-nav="true"
          data-stage-label="Contact"
        >
          <div className="section-top">
            <h2 className="section-title">Contact</h2>
            <p className="section-intro">
              For payment reliability, Android delivery, and production-facing
              incident work.
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
            <span className="copy-toast" data-copy-toast="true" aria-live="polite">
              Copied
            </span>
          </div>

          <div className="contact-links" data-contact-links="true">
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

          <div className="viewer-stage" data-viewer-stage="true">
            <div className="viewer-media" data-viewer-media="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="viewer-image"
                data-viewer-image="true"
                src={transparentPixel}
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

      <Script
        id="site-interactions"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: interactionScript }}
      />
    </div>
  );
}
