/* eslint-disable @next/next/no-img-element -- small local screenshots, served as captured */

import type { SiteShowcase as Showcase } from "../lib/canoe";

const newTab = <span className="sr-only">, opens in a new tab</span>;

/**
 * A glimpse of a live site: its home page, then the kinds of work it shows, each linking to the
 * page it was captured from. Two tall phone pages stand beside two wide desktop pages, so the set
 * reads as one object; a narrow container stacks it. `compact` keeps only the work, uncaptioned.
 */
export function SiteShowcase({ compact = false, showcase }: { compact?: boolean; showcase: Showcase }) {
  return (
    <div className="site-showcase" data-compact={compact ? "true" : undefined}>
      {compact ? null : (
        <a className="site-showcase-cover" href={showcase.href} rel="noopener noreferrer" target="_blank">
          <img alt={showcase.cover.alt} decoding="async" height="660" loading="lazy" src={showcase.cover.src} width="1600" />
          {newTab}
        </a>
      )}
      <ul aria-label={`Work on ${showcase.label}`} className="site-showcase-samples">
        {showcase.samples.map((sample) => (
          <li data-shape={sample.shape} key={sample.href}>
            <a href={sample.href} rel="noopener noreferrer" target="_blank">
              <img
                alt={sample.alt}
                decoding="async"
                height={sample.shape === "tall" ? 1400 : 900}
                loading="lazy"
                src={sample.src}
                width={sample.shape === "tall" ? 780 : 1600}
              />
              <span className={compact ? "sr-only" : "site-showcase-caption"}>{sample.caption}</span>
              {newTab}
            </a>
          </li>
        ))}
      </ul>
      {compact ? null : <p className="site-showcase-note">Captured from {showcase.label} as published. The samples are the studio&rsquo;s own concept pieces.</p>}
    </div>
  );
}
