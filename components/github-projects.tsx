"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowIcon, ChevronIcon } from "./icons";
import { SiteShowcase } from "./site-showcase";
import type { GithubProject, GithubProjectsPayload } from "../lib/github-projects";

function ProjectImage({
  project,
  priority = false,
}: {
  project: GithubProject;
  priority?: boolean;
}) {
  return (
    <span className="github-project-image" data-project={project.id}>
      <span className="github-project-image-fallback" aria-hidden="true">
        <b>{project.displayName}</b>
        <small>{project.kind === "site" ? "Live site" : "GitHub repository"}</small>
      </span>
      <img
        alt={project.kind === "site" ? `${project.displayName} home page` : `${project.displayName} repository preview`}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        height="315"
        loading={priority ? "eager" : "lazy"}
        onError={(event) => event.currentTarget.parentElement?.setAttribute("data-image-error", "true")}
        src={project.previewImageUrl}
        width="600"
      />
    </span>
  );
}

/**
 * Side projects stay secondary to the three cases: a plain list with each repository's own
 * language, description, and last update, opened inside Projects. A live product with private
 * source leads the list and reads "Live site" and its starting year instead.
 */
const rowLanguage = (project: GithubProject) => (project.kind === "site" ? "Live site" : project.language ?? "Repository");

export function GithubProjectsIndex({
  onOpenProject,
  projects,
  source,
}: {
  onOpenProject: (projectId: string) => void;
  projects: GithubProject[];
  source: GithubProjectsPayload["source"];
}) {
  const repositoryCount = projects.filter((project) => project.kind !== "site").length;
  return (
    <section className="github-projects-index" aria-labelledby="github-projects-heading" data-source={source}>
      <header className="github-projects-heading">
        <h2 id="github-projects-heading">Side projects</h2>
        <a
          aria-label={`All ${repositoryCount} public repositories on GitHub`}
          className="github-projects-github-link"
          href="https://github.com/fattah247?tab=repositories"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="github-project-count">{repositoryCount} public {repositoryCount === 1 ? "repo" : "repos"}</span> on GitHub <ArrowIcon />
        </a>
      </header>

      {projects.length ? (
        <ol aria-label="Side projects" className="github-project-ledger github-project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                aria-label={`Open ${project.displayName} project preview`}
                className="github-project-row"
                data-language={rowLanguage(project)}
                href={`/projects/${encodeURIComponent(project.id)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenProject(project.id);
                }}
              >
                <strong>{project.displayName}</strong>
                <span className="github-project-row-description">{project.description}</span>
                <span className="github-project-row-language">{rowLanguage(project)}</span>
                <span className="github-project-row-updated">{project.since ? `Since ${project.since}` : `Updated ${project.updatedLabel}`}</span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <div className="github-projects-empty">
          <p>No side projects to show right now.</p>
        </div>
      )}
    </section>
  );
}

export function GithubProjectPreview({
  onSelectProject,
  project,
  projects,
}: {
  onSelectProject: (projectId: string) => void;
  project: GithubProject;
  projects: GithubProject[];
}) {
  const projectIndex = projects.findIndex((item) => item.id === project.id);
  const previous = projects[(projectIndex - 1 + projects.length) % projects.length];
  const next = projects[(projectIndex + 1) % projects.length];

  return (
    <div className="github-project-preview" data-project={project.id}>
      <section className="github-project-preview-intro" aria-labelledby="github-project-preview-title">
        <div>
          <p>{project.kind === "site" ? "Live site" : project.language ?? "Public repository"}</p>
          <h2 id="github-project-preview-title">{project.displayName}</h2>
          <span>{project.description}</span>
        </div>
        <dl>
          {project.since ? <div><dt>Since</dt><dd>{project.since}</dd></div> : <div><dt>Updated</dt><dd>{project.updatedLabel}</dd></div>}
          <div><dt>{project.repositoryUrl ? "Repository" : "Source"}</dt><dd>{project.repositoryUrl ? "Public" : "Private"}</dd></div>
          <div><dt>Topics</dt><dd>{project.topics.length ? project.topics.join(" · ") : "Project source"}</dd></div>
        </dl>
      </section>

      {project.showcase ? (
        <section aria-label={`${project.displayName} and the work it shows`} className="github-project-showcase">
          <SiteShowcase showcase={project.showcase} />
        </section>
      ) : (
        <figure className="github-project-preview-figure">
          <ProjectImage priority project={project} />
          <figcaption>{project.kind === "site" ? `The ${project.displayName} home page.` : "Repository preview supplied by GitHub."}</figcaption>
        </figure>
      )}

      {project.readmeExcerpt && project.readmeExcerpt !== project.description ? (
        <section className="github-project-readme" aria-labelledby="github-project-readme-heading">
          <h3 id="github-project-readme-heading">{project.kind === "site" ? "About the site" : "About the repository"}</h3>
          <p>{project.readmeExcerpt}</p>
        </section>
      ) : null}

      <div className="github-project-actions">
        {project.repositoryUrl ? (
          <a className="primary-action" href={project.repositoryUrl} rel="noopener noreferrer" target="_blank">
            View source <ArrowIcon />
          </a>
        ) : null}
        {project.homepageUrl ? (
          <a className={project.repositoryUrl ? "inline-link" : "primary-action"} href={project.homepageUrl} rel="noopener noreferrer" target="_blank">
            {project.repositoryUrl ? "Open live site" : `Visit ${project.displayName}`} <ArrowIcon />
          </a>
        ) : null}
      </div>

      {projects.length > 1 ? (
        <nav className="github-project-switcher" aria-label="Move between side project previews">
          <button onClick={() => onSelectProject(previous.id)} type="button"><ChevronIcon /> Previous</button>
          <span>{String(projectIndex + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
          <button onClick={() => onSelectProject(next.id)} type="button">Next <ChevronIcon direction="right" /></button>
        </nav>
      ) : null}
    </div>
  );
}
