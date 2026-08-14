"use client";

import { useState, type MouseEvent } from "react";
import { ArrowIcon } from "./icons";
import { CopyEmailButton } from "./copy-email-button";
import { experience, principles, systemScope } from "../lib/content";
import { scenarios, type ScenarioSlug } from "../lib/scenarios";

type BriefView = "recruiter" | "engineering" | "full";

const cvHref = "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf";

const viewCopy: Record<BriefView, { label: string; note: string }> = {
  recruiter: {
    label: "Recruiter",
    note: "Emphasizes current role, scope, contact, and the downloadable one-page CV.",
  },
  engineering: {
    label: "Engineering",
    note: "Emphasizes selected work, system boundaries, public evidence, and technical tradeoffs.",
  },
  full: {
    label: "Full",
    note: "Keeps every section at equal weight for a complete read-through.",
  },
};

export function ExperienceBriefContent({
  onOpenCase,
  onOpenContact,
}: {
  onOpenCase: (slug: ScenarioSlug) => void;
  onOpenContact: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [view, setView] = useState<BriefView>("recruiter");
  const [openExperience, setOpenExperience] = useState(0);

  return (
    <div className="brief-page experience-brief-content" data-view={view}>
      <section className="brief-hero">
        <div>
          <h1>Muhammad<br />A. Fattah</h1>
        </div>
        <div className="brief-summary">
          <p className="brief-role">Software Engineer</p>
          <p>
            Building reliable payment systems and secure mobile clients, with an emphasis on readable state and production evidence.
          </p>
          <div className="brief-view-panel" aria-label="Brief reading mode">
            <div className="brief-view-switch" role="tablist" aria-label="Choose brief reading mode">
              {(Object.keys(viewCopy) as BriefView[]).map((key) => (
                <button
                  aria-selected={view === key}
                  className="brief-view-option"
                  key={key}
                  onClick={() => setView(key)}
                  role="tab"
                  type="button"
                >
                  {viewCopy[key].label}
                </button>
              ))}
            </div>
            <p>{viewCopy[view].note}</p>
          </div>
          <dl className="fact-grid">
            <div><dt>Current</dt><dd>Bank Central Asia</dd></div>
            <div><dt>Focus</dt><dd>Android POS · Payment reliability</dd></div>
            <div><dt>Location</dt><dd>Indonesia · UTC+7</dd></div>
            <div><dt>Contact</dt><dd><a href="#contact" onClick={onOpenContact}>Email</a> · <a href="https://www.linkedin.com/in/muhammad24fattah/" target="_blank" rel="noopener noreferrer">LinkedIn</a></dd></div>
          </dl>
          <div className="brief-actions">
            <a className="brief-action brief-download-action" href={cvHref} download>
              Download CV <ArrowIcon />
            </a>
            <a className="brief-action" href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">GitHub <span className="sr-only">opens in a new tab</span></a>
            <a className="brief-action" href="#contact" onClick={onOpenContact}>Contact</a>
          </div>
        </div>
      </section>

      <section className="brief-section brief-experience-section" data-brief-section="experience">
        <header className="brief-section-heading"><h2>Experience</h2></header>
        <div className="experience-list">
          {experience.map((item, index) => {
            const isOpen = openExperience === index;
            const panelId = `experience-panel-${index}`;
            return (
              <article className={`experience-entry ${isOpen ? "is-open" : ""}`} key={item.company}>
                <div className="experience-scale">
                  <span>{item.stage}</span>
                </div>
                <div className="experience-main">
                  <p className="experience-period">{item.period}</p>
                  <h2>
                    <button
                      aria-controls={panelId}
                      aria-expanded={isOpen}
                      className="experience-toggle"
                      onClick={() => setOpenExperience(isOpen ? -1 : index)}
                      type="button"
                    >
                      <span>{item.role}</span>
                      <small>{isOpen ? "Collapse details" : "Open details"}</small>
                      <i aria-hidden="true" />
                    </button>
                  </h2>
                  <p className="experience-company">{item.company} · Indonesia</p>
                  <p className="experience-scope">{item.scope}</p>
                  <div className="experience-detail-panel" id={panelId} aria-hidden={!isOpen}>
                    <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="brief-section brief-work-section" data-brief-section="work">
        <header className="brief-section-heading"><h2>Selected work</h2></header>
        <div className="brief-case-list">
          {scenarios.map((scenario) => (
            <a
              className="brief-case"
              href={`/case/${scenario.slug}`}
              key={scenario.slug}
              onClick={(event) => {
                event.preventDefault();
                onOpenCase(scenario.slug);
              }}
            >
              <span>{scenario.number}</span>
              <div><h2>{scenario.shortTitle}</h2><p>{scenario.consequence}</p></div>
              <ArrowIcon />
            </a>
          ))}
        </div>
      </section>

      <section className="brief-section brief-scope-section" data-brief-section="scope">
        <header className="brief-section-heading"><h2>System scope</h2></header>
        <div className="scope-map">
          {systemScope.map((item, index) => (
            <div className="scope-row" key={item.label}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><p>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="brief-section principles-section">
        <header className="brief-section-heading"><h2>Operating principles</h2></header>
        <ol className="principles-list">
          {principles.map((principle, index) => <li key={principle}><span>{String(index + 1).padStart(2, "0")}</span>{principle}</li>)}
        </ol>
      </section>

      <section className="brief-contact" id="experience-contact">
        <p className="micro-label">Contact</p>
        <h2>If the happy path is handled, I’m interested in what happens next.</h2>
        <p className="contact-email">fattahmuhammad17@gmail.com</p>
        <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy email address" className="contact-copy-action" />
      </section>
    </div>
  );
}
