"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowIcon, ChevronIcon } from "./icons";
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
        <small>GitHub repository</small>
      </span>
      <img
        alt={`${project.displayName} repository preview`}
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
 * Side projects stay secondary to the three cases: a plain repository list with each
 * repository's own language, description, and last update, opened inside Projects.
 */
export function GithubProjectsIndex({
  onOpenProject,
  projects,
  source,
}: {
  onOpenProject: (projectId: string) => void;
  projects: GithubProject[];
  source: GithubProjectsPayload["source"];
}) {
  return (
    <section className="github-projects-index" aria-labelledby="github-projects-heading" data-source={source}>
      <header className="github-projects-heading">
        <h2 id="github-projects-heading">Side projects</h2>
        <a
          aria-label={`All ${projects.length} public repositories on GitHub`}
          className="github-projects-github-link"
          href="https://github.com/fattah247?tab=repositories"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="github-project-count">{projects.length} public {projects.length === 1 ? "repo" : "repos"}</span> on GitHub <ArrowIcon />
        </a>
      </header>

      {projects.length ? (
        <ol aria-label="Side projects" className="github-project-ledger github-project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                aria-label={`Open ${project.displayName} project preview`}
                className="github-project-row"
                data-language={project.language ?? "Repository"}
                href={`/projects/${encodeURIComponent(project.id)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenProject(project.id);
                }}
              >
                <strong>{project.displayName}</strong>
                <span className="github-project-row-description">{project.description}</span>
                <span className="github-project-row-language">{project.language ?? "Repository"}</span>
                <span className="github-project-row-updated">Updated {project.updatedLabel}</span>
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
          <p>{project.language ?? "Public repository"}</p>
          <h2 id="github-project-preview-title">{project.displayName}</h2>
          <span>{project.description}</span>
        </div>
        <dl>
          <div><dt>Updated</dt><dd>{project.updatedLabel}</dd></div>
          <div><dt>Repository</dt><dd>Public</dd></div>
          <div><dt>Topics</dt><dd>{project.topics.length ? project.topics.join(" · ") : "Project source"}</dd></div>
        </dl>
      </section>

      <figure className="github-project-preview-figure">
        <ProjectImage priority project={project} />
        <figcaption>Repository preview supplied by GitHub.</figcaption>
      </figure>

      {project.readmeExcerpt && project.readmeExcerpt !== project.description ? (
        <section className="github-project-readme" aria-labelledby="github-project-readme-heading">
          <h3 id="github-project-readme-heading">About the repository</h3>
          <p>{project.readmeExcerpt}</p>
        </section>
      ) : null}

      <div className="github-project-actions">
        <a className="primary-action" href={project.repositoryUrl} rel="noopener noreferrer" target="_blank">
          View source <ArrowIcon />
        </a>
        {project.homepageUrl ? (
          <a className="inline-link" href={project.homepageUrl} rel="noopener noreferrer" target="_blank">
            Open live site <ArrowIcon />
          </a>
        ) : null}
      </div>

      {projects.length > 1 ? (
        <nav className="github-project-switcher" aria-label="Move between GitHub project previews">
          <button onClick={() => onSelectProject(previous.id)} type="button"><ChevronIcon /> Previous</button>
          <span>{String(projectIndex + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
          <button onClick={() => onSelectProject(next.id)} type="button">Next <ChevronIcon direction="right" /></button>
        </nav>
      ) : null}
    </div>
  );
}
