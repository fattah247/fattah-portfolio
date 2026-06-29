import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { PortfolioHeader } from "@/components/portfolio-header";
import { PrintBriefButton } from "@/components/print-brief-button";
import { experience, principles, systemScope } from "@/lib/content";
import { scenarios } from "@/lib/scenarios";

export default function BriefPage() {
  return (
    <>
      <PortfolioHeader />
      <main className="brief-page" id="main-content">
        <section className="brief-hero">
          <div>
            <p className="micro-label">Recruiter brief / printable overview</p>
            <h1>Muhammad<br />A. Fattah</h1>
          </div>
          <div className="brief-summary">
            <p className="brief-role">Software Engineer</p>
            <p>
              Building reliable payment systems and secure mobile clients, with an emphasis on readable state and production evidence.
            </p>
            <dl className="fact-grid">
              <div><dt>Current</dt><dd>Bank Central Asia</dd></div>
              <div><dt>Focus</dt><dd>Android POS · Payment reliability</dd></div>
              <div><dt>Location</dt><dd>Indonesia · UTC+7</dd></div>
              <div><dt>Contact</dt><dd><a href="#contact">Email</a> · <a href="https://www.linkedin.com/in/muhammad24fattah/" target="_blank" rel="noopener noreferrer">LinkedIn</a></dd></div>
            </dl>
            <div className="brief-actions">
              <PrintBriefButton />
              <a className="brief-action" href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">GitHub <span className="sr-only">opens in a new tab</span></a>
              <a className="brief-action" href="#contact">Contact</a>
            </div>
          </div>
        </section>

        <section className="brief-section">
          <div className="section-label"><span>01</span><p>Experience</p></div>
          <div className="experience-list">
            {experience.map((item) => (
              <article className="experience-entry" key={item.company}>
                <div className="experience-scale">
                  <span>{item.stage}</span>
                </div>
                <div className="experience-main">
                  <p className="experience-period">{item.period}</p>
                  <h2>{item.role}</h2>
                  <p className="experience-company">{item.company} · Indonesia</p>
                  <p className="experience-scope">{item.scope}</p>
                  <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="brief-section">
          <div className="section-label"><span>02</span><p>Selected work</p></div>
          <div className="brief-case-list">
            {scenarios.map((scenario) => (
              <Link className="brief-case" href={`/case/${scenario.slug}`} key={scenario.slug}>
                <span>{scenario.number}</span>
                <div><h2>{scenario.shortTitle}</h2><p>{scenario.consequence}</p></div>
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </section>

        <section className="brief-section">
          <div className="section-label"><span>03</span><p>System scope</p></div>
          <div className="scope-map">
            {systemScope.map((item, index) => (
              <div className="scope-row" key={item.label}>
                <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><p>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="brief-section principles-section">
          <div className="section-label"><span>04</span><p>Operating principles</p></div>
          <ol className="principles-list">
            {principles.map((principle, index) => <li key={principle}><span>{String(index + 1).padStart(2, "0")}</span>{principle}</li>)}
          </ol>
        </section>

        <section className="brief-contact" id="contact">
          <p className="micro-label">Contact</p>
          <h2>If the happy path is handled, I’m interested in what happens next.</h2>
          <p className="contact-email">fattahmuhammad17@gmail.com</p>
          <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy email address" className="contact-copy-action" />
        </section>
      </main>
    </>
  );
}
