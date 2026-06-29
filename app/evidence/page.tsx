import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { PortfolioHeader } from "@/components/portfolio-header";
import { additionalRepos } from "@/lib/content";
import { scenarios } from "@/lib/scenarios";

export default function EvidencePage() {
  return (
    <>
      <PortfolioHeader />
      <main className="evidence-page" id="main-content">
        <section className="evidence-hero">
          <p className="micro-label">Public work and boundaries</p>
          <h1>Claims should leave evidence.</h1>
          <p>
            Public labs support the technical claims below. Professional experience is described separately and does not imply access to employer source code.
          </p>
        </section>

        <section className="claim-ledger">
          <div className="claim-header"><span>Claim</span><span>Evidence</span><span>Boundary</span></div>
          {scenarios.map((scenario) => (
            <article className="claim-row" key={scenario.slug}>
              <div><span>{scenario.number}</span><h2>{scenario.shortTitle}</h2><p>{scenario.consequence}</p></div>
              <div className="claim-evidence">
                <div className="claim-thumb"><Image src={scenario.evidence[0].src} alt="" fill sizes="180px" unoptimized /></div>
                <div><p>{scenario.evidence[0].caption}</p><Link href={`/case/${scenario.slug}`}>Replay case <ArrowIcon /></Link></div>
              </div>
              <p>{scenario.limitation}</p>
            </article>
          ))}
        </section>

        <section className="repository-index">
          <div><p className="micro-label">Other projects</p><h2>Additional public repositories</h2></div>
          <div>
            {additionalRepos.map((repo) => (
              <a href={repo.href} target="_blank" rel="noopener noreferrer" key={repo.name}>
                <span><strong>{repo.name}</strong><small>{repo.detail}</small></span><ArrowIcon />
              </a>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
