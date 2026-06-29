"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { scenarios, type ScenarioSlug } from "@/lib/scenarios";

type SplashStage = "showing" | "leaving" | "done";

const caseDetails: Record<ScenarioSlug, { area: string; technology: string; result: ReactNode }> = {
  payflow: {
    area: "Payment reliability",
    technology: "Spring Boot · PostgreSQL",
    result: <><b>2</b> deliveries <span>/</span> <b>1</b> payment change</>,
  },
  iyup: {
    area: "Service observability",
    technology: "Prometheus · Grafana",
    result: <>Latency warned <b>before</b> health failed</>,
  },
  trustgate: {
    area: "Android device trust",
    technology: "Kotlin · Jetpack Compose",
    result: <>Suspicion became <b>confirmation</b>, not an automatic block</>,
  },
};

function Splash({ stage, onSkip }: { stage: SplashStage; onSkip: () => void }) {
  if (stage === "done") return null;
  return (
    <section className="portfolio-splash" data-stage={stage} aria-label="Portfolio introduction">
      <button className="splash-skip" onClick={onSkip} type="button">Skip introduction</button>
      <div className="splash-inner">
        <div className="splash-name-stage">
          <span className="splash-name splash-ghost ghost-one" aria-hidden="true" />
          <span className="splash-name splash-ghost ghost-two" aria-hidden="true" />
          <p className="splash-name splash-master"><span>Muhammad</span><span>A. Fattah</span></p>
          {stage === "showing" ? <i className="splash-locator" aria-hidden="true" /> : null}
        </div>
        <div className="splash-role">
          <i className="splash-role-locator" aria-hidden="true" />
          <small className="splash-context">Portfolio route</small>
          <p>Software Engineer</p>
          <span>Android POS · Merchant Payments</span>
          <div className="splash-sequence" aria-hidden="true">
            <b>Failure</b>
            <b>Decision</b>
            <b>Evidence</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkRow({ scenario, index }: { scenario: (typeof scenarios)[number]; index: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.22 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const detail = caseDetails[scenario.slug];
  return (
    <Link
      ref={ref}
      href={`/case/${scenario.slug}`}
      className={`editorial-work-row ${visible ? "is-visible" : ""}`}
      style={{ "--row-delay": `${index * 70}ms` } as CSSProperties}
    >
      <span className="work-index" style={{ viewTransitionName: `case-number-${scenario.slug}` } as CSSProperties}>
        <i aria-hidden="true" />
        <span className="work-number">{scenario.number}</span>
      </span>
      <span className="work-main">
        <span className="work-area">{detail.area}</span>
        <strong style={{ viewTransitionName: `case-title-${scenario.slug}` } as CSSProperties}>{scenario.shortTitle}</strong>
        <span className="work-summary">{scenario.consequence}</span>
      </span>
      <span className="work-side">
        <span>{detail.technology}</span>
        <span className="work-result">{detail.result}</span>
        <span className={`work-preview preview-${scenario.slug}`} aria-hidden="true">
          {scenario.slug === "payflow" ? <><i /><i /><b /></> : null}
          {scenario.slug === "iyup" ? <><i /><i /><b /></> : null}
          {scenario.slug === "trustgate" ? <><i /><b>ALLOW</b><b>CONFIRM</b></> : null}
        </span>
      </span>
      <span className="work-arrow" aria-hidden="true"><ArrowIcon /></span>
    </Link>
  );
}

export function CounterfactualHome() {
  const [splashStage, setSplashStage] = useState<SplashStage>("showing");
  const splashTimers = useRef<number[]>([]);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timers = splashTimers.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.matchMedia("(max-width: 760px)").matches;
    if (reduced) {
      timers.push(window.setTimeout(() => setSplashStage("done"), 0));
      return () => timers.forEach(window.clearTimeout);
    }
    timers.push(
      window.setTimeout(() => setSplashStage("leaving"), compact ? 1450 : 1650),
      window.setTimeout(() => {
        setSplashStage("done");
      }, compact ? 1900 : 2150),
    );
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".portfolio-header");
    if (header) header.dataset.introStage = splashStage;
    return () => {
      if (header) delete header.dataset.introStage;
    };
  }, [splashStage]);

  useEffect(() => {
    if (splashStage === "done") return;
    const previous = document.body.style.overflow;
    const isolated = Array.from(document.querySelectorAll<HTMLElement>(".portfolio-header, .editorial-home"));
    document.body.style.overflow = "hidden";
    isolated.forEach((element) => element.setAttribute("inert", ""));
    const skipWithKey = (event: KeyboardEvent) => {
      if (!["Escape", "Enter", " "].includes(event.key)) return;
      splashTimers.current.forEach(window.clearTimeout);
      setSplashStage("leaving");
      splashTimers.current.push(window.setTimeout(() => setSplashStage("done"), 360));
    };
    window.addEventListener("keydown", skipWithKey);
    return () => {
      document.body.style.overflow = previous;
      isolated.forEach((element) => element.removeAttribute("inert"));
      window.removeEventListener("keydown", skipWithKey);
    };
  }, [splashStage]);

  useEffect(() => {
    const hero = heroRef.current;
    const header = document.querySelector<HTMLElement>(".portfolio-header");
    if (!hero || !header || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      header.dataset.heroPast = String(!entry.isIntersecting);
    }, { threshold: 0.08 });
    observer.observe(hero);
    return () => {
      observer.disconnect();
      delete header.dataset.heroPast;
    };
  }, []);

  function skipSplash() {
    splashTimers.current.forEach(window.clearTimeout);
    setSplashStage("leaving");
    splashTimers.current.push(window.setTimeout(() => setSplashStage("done"), 360));
  }

  return (
    <>
      <Splash stage={splashStage} onSkip={skipSplash} />
      <main className="home-page editorial-home" data-intro={splashStage} id="main-content">
        <section className="editorial-hero" ref={heroRef} aria-labelledby="home-title">
          <div className="hero-identity">
            <p className="hero-kicker">Software Engineer · Indonesia</p>
            <h1 id="home-title"><span>Muhammad</span><span>A. Fattah</span></h1>
          </div>
          <div className="hero-summary">
            <p className="hero-role">I work on Android POS and merchant payment systems.</p>
            <p className="hero-description">
              I build for the conditions outside the happy path: repeated requests,
              slowing services, and device signals that disagree.
            </p>
            <p className="hero-purpose">
              This portfolio explains three engineering decisions, the results they produced,
              and the public evidence behind them.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#selected-work">View selected work <ArrowIcon /></a>
              <div className="hero-secondary-actions">
                <Link href="/brief">Experience</Link>
                <a href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">GitHub</a>
                <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy email" className="hero-email-action" />
              </div>
            </div>
          </div>
        </section>

        <section className="editorial-work" id="selected-work" aria-labelledby="work-title">
          <div className="work-intro">
            <p>Selected work</p>
            <h2 id="work-title">Three failures.<br />Three decisions.</h2>
            <p>Start with the consequence. Open a case for the reasoning, behavior, code, and limitation.</p>
          </div>
          <div className="editorial-work-list">
            {scenarios.map((scenario, index) => <WorkRow scenario={scenario} index={index} key={scenario.slug} />)}
          </div>
        </section>

        <section className="editorial-footer">
          <p>Currently building Android POS and merchant payment systems at Bank Central Asia.</p>
          <Link href="/brief">Read experience and contact <ArrowIcon /></Link>
        </section>
      </main>
    </>
  );
}
