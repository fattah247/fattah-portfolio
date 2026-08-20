"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { ArrowIcon } from "./icons";
import { experience, principles, systemScope } from "../lib/content";

const cvHref = "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf";

export function ExperienceBriefContent({
  onOpenWork,
  onOpenContact,
}: {
  onOpenWork: (event: MouseEvent<HTMLAnchorElement>) => void;
  onOpenContact: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <article className="brief-page experience-brief-content">
      <header className="experience-brief-utility">
        <div className="experience-brief-identity">
          <span>Software Engineer</span>
          <strong>Muhammad A. Fattah</strong>
        </div>
        <nav className="experience-brief-actions" aria-label="Experience actions">
          <a className="experience-brief-action is-primary" href={cvHref} download>
            Download CV <ArrowIcon />
          </a>
          <a className="experience-brief-action" href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">
            GitHub <span className="sr-only">opens in a new tab</span>
          </a>
          <a className="experience-brief-action" href="#contact" onClick={onOpenContact}>Contact</a>
        </nav>
      </header>

      <section className="experience-brief-intro" aria-labelledby="experience-brief-title">
        <div className="experience-brief-heading">
          <p>Experience record</p>
          <h1 id="experience-brief-title">Roles, scope, and responsibility.</h1>
        </div>
        <div className="experience-brief-summary">
          <p>
            A chronological view of where I worked, what I was responsible for, and the systems around that work.
          </p>
          <dl className="experience-brief-facts">
            <div><dt>Current</dt><dd>Bank Central Asia</dd></div>
            <div><dt>Focus</dt><dd>Android POS · Payment reliability</dd></div>
            <div><dt>Location</dt><dd>Indonesia · UTC+7</dd></div>
          </dl>
        </div>
      </section>

      <section className="experience-brief-section brief-experience-section" aria-labelledby="experience-heading">
        <header className="experience-brief-section-heading">
          <h2 id="experience-heading">Role history</h2>
        </header>
        <div className="experience-list">
          {experience.map((item) => (
            <article className="experience-entry" key={item.company}>
              <div className="experience-entry-meta">
                <p className="experience-period">{item.period}</p>
                <p className="experience-company">{item.company}</p>
                <span>{item.stage}</span>
              </div>
              <div className="experience-main">
                <h3>{item.role}</h3>
                <p className="experience-scope">{item.scope}</p>
                <ul className="experience-details">
                  {item.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="experience-brief-section brief-scope-section" aria-labelledby="system-scope-heading">
        <header className="experience-brief-section-heading">
          <h2 id="system-scope-heading">System scope</h2>
        </header>
        <div className="scope-map">
          {systemScope.map((item) => (
            <div className="scope-row" key={item.label}>
              <strong>{item.label}</strong><p>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="experience-brief-section principles-section" aria-labelledby="principles-heading">
        <header className="experience-brief-section-heading">
          <h2 id="principles-heading">Operating principles</h2>
          <p>The constraints used to reason about failure, state, and evidence.</p>
        </header>
        <ol className="principles-list">
          {principles.map((principle, index) => (
            <li key={principle}><span>{String(index + 1).padStart(2, "0")}</span>{principle}</li>
          ))}
        </ol>
      </section>

      <section className="experience-work-handoff" aria-labelledby="experience-work-handoff-heading">
        <div>
          <h2 id="experience-work-handoff-heading">Cases and evidence are in Projects.</h2>
          <p>The failure cases, decisions, replays, and attached evidence are kept there.</p>
        </div>
        <Link className="experience-brief-action is-primary" href="/#selected-work" onClick={onOpenWork}>
          Open Projects <ArrowIcon />
        </Link>
      </section>
    </article>
  );
}
