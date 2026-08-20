"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowIcon } from "./icons";
import type { GithubProject, GithubProjectsPayload } from "../lib/github-projects";

const railStepDelay = 3_200;
const railResumeDelay = 2_400;
const railSettleDelay = 560;

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

export function GithubProjectsIndex({
  onOpenProject,
  projects,
  source,
}: {
  onOpenProject: (projectId: string) => void;
  projects: GithubProject[];
  source: GithubProjectsPayload["source"];
}) {
  const initialRotation = projects.length > 1 ? projects.length - 1 : 0;
  const railRef = useRef<HTMLOListElement>(null);
  const [rotation, setRotation] = useState(initialRotation);
  const hoverPaused = useRef(false);
  const focusPaused = useRef(false);
  const interactionPaused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationRef = useRef(initialRotation);
  const resetAfterRotation = useRef<number | null>(null);
  const anchorInitialized = useRef(false);
  const autoAnimating = useRef(false);
  const advanceRailRef = useRef<(() => void) | null>(null);
  const lastAdvanceAt = useRef(0);
  const pointerFocus = useRef(false);
  const pointerX = useRef<number | null>(null);
  const normalizationFrame = useRef<number | null>(null);
  const normalizationIntent = useRef(0);

  const rotatedProjects = projects.length
    ? [...projects.slice(rotation), ...projects.slice(0, rotation)]
    : projects;

  const rotateRail = useCallback((steps: number, resetLeft = 0, immediately = false) => {
    if (!projects.length) return;
    rotationRef.current = (rotationRef.current + steps + projects.length) % projects.length;
    resetAfterRotation.current = Math.max(0, resetLeft);
    if (immediately) {
      flushSync(() => setRotation(rotationRef.current));
      return;
    }
    setRotation(rotationRef.current);
  }, [projects.length]);

  const pauseTemporarily = () => {
    interactionPaused.current = true;
    if (autoAnimating.current) {
      autoAnimating.current = false;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      const rail = railRef.current;
      if (rail) rail.scrollTo({ behavior: "auto", left: rail.scrollLeft });
    }
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      interactionPaused.current = false;
      hoverPaused.current = false;
      if (!focusPaused.current) advanceRailRef.current?.();
    }, railResumeDelay);
  };

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (normalizationFrame.current !== null) cancelAnimationFrame(normalizationFrame.current);
  }, []);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (resetAfterRotation.current !== null) {
      const resetLeft = resetAfterRotation.current;
      resetAfterRotation.current = null;
      rail.scrollLeft = resetLeft;
      rail.scrollTo({ behavior: "auto", left: resetLeft });
      return;
    }
    if (anchorInitialized.current) return;
    const items = Array.from(rail.children) as HTMLElement[];
    if (items.length < 3) return;
    anchorInitialized.current = true;
    const anchorLeft = items[1].offsetLeft - items[0].offsetLeft;
    rail.scrollLeft = anchorLeft;
    rail.scrollTo({ behavior: "auto", left: anchorLeft });
  }, [rotation]);

  useEffect(() => {
    if (projects.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const advanceRail = () => {
      const rail = railRef.current;
      if (!rail || document.visibilityState === "hidden" || hoverPaused.current || focusPaused.current || interactionPaused.current) return;

      const items = Array.from(rail.children) as HTMLElement[];
      if (items.length < 3) return;
      const firstOffset = items[0].offsetLeft;
      const itemLeft = (item: HTMLElement) => item.offsetLeft - firstOffset;

      const current = items.reduce((nearest, item, index) => (
        Math.abs(itemLeft(item) - rail.scrollLeft) < Math.abs(itemLeft(items[nearest]) - rail.scrollLeft) ? index : nearest
      ), 0);

      if (current !== 1) {
        const shift = current - 1;
        const step = itemLeft(items[1]);
        rotateRail(shift, step + rail.scrollLeft - itemLeft(items[current]));
        lastAdvanceAt.current = Date.now();
        return;
      }

      autoAnimating.current = true;
      rail.scrollTo({
        behavior: "smooth",
        left: itemLeft(items[2]),
      });
      lastAdvanceAt.current = Date.now();
      settleTimer.current = setTimeout(() => {
        autoAnimating.current = false;
        rotateRail(1, itemLeft(items[1]));
      }, railSettleDelay);
    };

    advanceRailRef.current = advanceRail;
    const interval = window.setInterval(() => {
      if (Date.now() - lastAdvanceAt.current >= railStepDelay) advanceRail();
    }, railStepDelay);

    return () => {
      window.clearInterval(interval);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      advanceRailRef.current = null;
    };
  }, [projects.length, rotateRail]);

  const normalizeManualScroll = (intent = 0) => {
    const rail = railRef.current;
    if (!rail || autoAnimating.current || !interactionPaused.current) return;
    const items = Array.from(rail.children) as HTMLElement[];
    if (items.length < 3) return;
    const step = items[1].offsetLeft - items[0].offsetLeft;
    if (step <= 0) return;
    if (intent <= 0 && rail.scrollLeft <= 1) {
      rotateRail(-1, rail.scrollLeft + step, true);
      return;
    }
    const measuredMaxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const maxScrollLeft = measuredMaxScrollLeft > 1 ? measuredMaxScrollLeft : step * 2;
    const forwardBoundary = Math.min(step * 2, maxScrollLeft);
    if (intent < 0 || forwardBoundary <= 1 || rail.scrollLeft < forwardBoundary - 1) return;
    const crossedItems = Math.min(
      projects.length - 1,
      Math.max(1, Math.floor((rail.scrollLeft + 1) / step) - 1),
    );
    rotateRail(crossedItems, rail.scrollLeft - (crossedItems * step), true);
  };

  const scheduleManualNormalization = (intent = 0) => {
    if (intent) normalizationIntent.current = intent;
    if (normalizationFrame.current !== null) return;

    normalizationFrame.current = requestAnimationFrame(() => {
      normalizationFrame.current = null;
      const scheduledIntent = normalizationIntent.current;
      normalizationIntent.current = 0;
      normalizeManualScroll(scheduledIntent);
    });
  };

  return (
    <section className="github-projects-index" aria-labelledby="github-projects-heading">
      <header className="github-projects-heading">
        <div>
          <h2 id="github-projects-heading">More projects</h2>
          <p>Selected public repositories.</p>
        </div>
        <div className="github-projects-origin">
          <span>{source === "github" ? "GitHub index · cached 6 hours" : "Cached GitHub index"}</span>
          <a href="https://github.com/fattah247?tab=repositories" rel="noopener noreferrer" target="_blank">
            All repositories <ArrowIcon />
          </a>
        </div>
      </header>

      {projects.length ? (
        <ol
          aria-label="More public projects, continuously rolling"
          className="github-project-ledger"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) focusPaused.current = false;
          }}
          onFocus={() => {
            if (!pointerFocus.current) focusPaused.current = true;
          }}
          onKeyDown={(event) => {
            pauseTemporarily();
            if (event.key === "ArrowLeft") scheduleManualNormalization(-1);
            if (event.key === "ArrowRight") scheduleManualNormalization(1);
          }}
          onMouseEnter={() => { hoverPaused.current = true; }}
          onMouseLeave={() => {
            hoverPaused.current = false;
            if (!focusPaused.current && !interactionPaused.current) advanceRailRef.current?.();
          }}
          onPointerCancel={() => {
            pointerFocus.current = false;
            pointerX.current = null;
            pauseTemporarily();
          }}
          onPointerDown={(event) => {
            pointerFocus.current = true;
            pointerX.current = event.clientX;
            pauseTemporarily();
          }}
          onPointerMove={(event) => {
            if (!pointerFocus.current || pointerX.current === null) return;
            const intent = pointerX.current - event.clientX;
            pointerX.current = event.clientX;
            if (Math.abs(intent) > 1) scheduleManualNormalization(intent);
          }}
          onPointerUp={() => {
            pointerFocus.current = false;
            pointerX.current = null;
            pauseTemporarily();
          }}
          onScroll={() => scheduleManualNormalization()}
          onWheel={(event) => {
            pauseTemporarily();
            const intent = Math.abs(event.deltaX) >= Math.abs(event.deltaY)
              ? event.deltaX
              : event.shiftKey ? event.deltaY : 0;
            if (intent) scheduleManualNormalization(intent);
          }}
          ref={railRef}
        >
          {rotatedProjects.map((project) => {
            const projectIndex = projects.findIndex((item) => item.id === project.id);
            return (
            <li key={project.id}>
              <a
                className="github-project-row"
                href={`/projects/${encodeURIComponent(project.id)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenProject(project.id);
                }}
              >
                <span className="github-project-number">{String(projectIndex + 1).padStart(2, "0")}</span>
                <span className="github-project-row-copy">
                  <span>{project.language ?? "Repository"} · {project.updatedLabel}</span>
                  <strong>{project.displayName}</strong>
                  <p>{project.description}</p>
                </span>
                <span className="github-project-row-arrow" aria-hidden="true"><ArrowIcon /></span>
              </a>
            </li>
            );
          })}
        </ol>
      ) : (
        <div className="github-projects-empty">
          <strong>No additional projects selected.</strong>
          <p>Repositories appear here after they receive the public <code>portfolio</code> topic on GitHub.</p>
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

      <section className="github-project-readme" aria-labelledby="github-project-readme-heading">
        <h3 id="github-project-readme-heading">About the repository</h3>
        <p>{project.readmeExcerpt}</p>
      </section>

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
          <button onClick={() => onSelectProject(previous.id)} type="button">← Previous</button>
          <span>{String(projectIndex + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
          <button onClick={() => onSelectProject(next.id)} type="button">Next →</button>
        </nav>
      ) : null}
    </div>
  );
}
