import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canoeShowcase } from "../lib/canoe";
import type { GithubProject } from "../lib/github-projects";
import { GithubProjectPreview, GithubProjectsIndex } from "./github-projects";

const site: GithubProject = {
  description: "Website for Canoe, the independent studio I founded in 2019.",
  displayName: "canoe.quest",
  homepageUrl: "https://canoe.quest",
  id: "canoe",
  kind: "site",
  language: null,
  previewImageUrl: "/projects/canoe/home.webp",
  readmeExcerpt: "A bilingual site, in English and Indonesian, built with Astro.",
  repositoryUrl: null,
  since: "2019",
  topics: ["astro"],
  updatedAt: "",
  updatedLabel: "",
};

const repository: GithubProject = {
  description: "IDX filing analysis automation system.",
  displayName: "Stock Triage",
  homepageUrl: null,
  id: "Stock-Triage",
  language: "Python",
  previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/Stock-Triage",
  readmeExcerpt: "A local workflow for collecting public IDX filings.",
  repositoryUrl: "https://github.com/fattah247/Stock-Triage",
  topics: [],
  updatedAt: "2026-05-20T07:12:21Z",
  updatedLabel: "May 2026",
};

afterEach(cleanup);

describe("side projects", () => {
  it("lists a live site as such and counts only repositories toward GitHub", () => {
    render(<GithubProjectsIndex onOpenProject={vi.fn()} projects={[site, repository]} source="github" />);

    const siteRow = screen.getByRole("link", { name: "Open canoe.quest project preview" });
    expect(siteRow.getAttribute("data-language")).toBe("Live site");
    expect(within(siteRow).getByText("Since 2019")).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "Open Stock Triage project preview" })).getByText("Updated May 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "All 1 public repositories on GitHub" }).textContent).toContain("1 public repo");
  });

  it("opens a live site with a visit link instead of a source link", () => {
    render(<GithubProjectPreview onSelectProject={vi.fn()} project={site} projects={[site, repository]} />);

    const visit = screen.getByRole("link", { name: "Visit canoe.quest" });
    expect(visit.getAttribute("href")).toBe("https://canoe.quest");
    expect(visit.getAttribute("target")).toBe("_blank");
    expect(screen.queryByRole("link", { name: "View source" })).toBeNull();
    expect(screen.getByRole("heading", { name: "About the site" })).toBeTruthy();
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("shows a site's home page and its work, each linking to the page it was captured from", () => {
    render(<GithubProjectPreview onSelectProject={vi.fn()} project={{ ...site, showcase: canoeShowcase }} projects={[site, repository]} />);

    const work = screen.getByRole("list", { name: "Work on canoe.quest" });
    const samples = within(work).getAllByRole("link");
    expect(samples.map((link) => link.getAttribute("href"))).toEqual(canoeShowcase.samples.map((sample) => sample.href));
    expect(samples.every((link) => link.getAttribute("target") === "_blank")).toBe(true);
    expect(within(work).getAllByText(/concept$/)).toHaveLength(4);
    expect(screen.getByText(/The samples are the studio’s own concept pieces/)).toBeTruthy();
  });

  it("keeps the source link first for a public repository", () => {
    render(<GithubProjectPreview onSelectProject={vi.fn()} project={repository} projects={[site, repository]} />);

    expect(screen.getByRole("link", { name: "View source" }).getAttribute("href")).toBe("https://github.com/fattah247/Stock-Triage");
    expect(screen.getByRole("navigation", { name: "Move between side project previews" })).toBeTruthy();
  });
});
