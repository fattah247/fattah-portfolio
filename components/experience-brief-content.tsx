"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { ChevronIcon, DownloadIcon } from "./icons";
import { OwnerMark } from "./app-icons";
import { experience, principles, systemScope } from "../lib/content";
import { portfolioIdentity } from "../lib/portfolio-identity";

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
        <nav className="experience-brief-actions" aria-label="Experience actions">
          <a className="experience-brief-action is-primary" href={portfolioIdentity.cv} download>
            Download CV <DownloadIcon />
          </a>
          <a className="experience-brief-action" href={portfolioIdentity.github} target="_blank" rel="noopener noreferrer">
            GitHub <span className="sr-only">opens in a new tab</span>
          </a>
          <a className="experience-brief-action" href="#contact" onClick={onOpenContact}>Contact</a>
        </nav>
      </header>

      <section className="experience-brief-intro" aria-labelledby="experience-brief-title">
        <div className="experience-brief-heading">
          <OwnerMark className="experience-brief-mark" />
          <div>
            <h1 id="experience-brief-title">{portfolioIdentity.name}</h1>
          </div>
        </div>
        <div className="experience-brief-summary">
          <dl className="experience-brief-facts">
            <div><dt>Role</dt><dd>{portfolioIdentity.role}</dd></div>
            <div><dt>Focus</dt><dd>{portfolioIdentity.focus}</dd></div>
            <div><dt>Based in</dt><dd>{portfolioIdentity.location} · UTC+7</dd></div>
          </dl>
        </div>
      </section>

      <section className="experience-brief-section brief-experience-section" aria-labelledby="experience-heading">
        <header className="experience-brief-section-heading">
          <h2 id="experience-heading">Role history</h2>
        </header>
        <div className="experience-list">
          {experience.map((item, index) => (
            <article className="experience-entry" data-current={index === 0 ? "true" : undefined} key={item.company}>
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
              <strong>{item.label}</strong>
              <p>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="experience-brief-section principles-section" aria-labelledby="principles-heading">
        <header className="experience-brief-section-heading">
          <h2 id="principles-heading">Operating principles</h2>
        </header>
        <ol className="principles-list">
          {principles.map((principle, index) => (
            <li key={principle}><span>{String(index + 1).padStart(2, "0")}</span>{principle}</li>
          ))}
        </ol>
      </section>

      <p className="experience-work-handoff">
        The three public labs and their evidence are in{" "}
        <Link href="/#selected-work" onClick={onOpenWork}>Projects <ChevronIcon direction="right" /></Link>
      </p>
    </article>
  );
}
