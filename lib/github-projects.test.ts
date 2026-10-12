import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGithubProjects, type GithubProject } from "./github-projects";

type NextRequestInit = RequestInit & { next?: { revalidate?: number } };

function repository(overrides: Record<string, unknown> = {}) {
  return {
    archived: false,
    description: "A public project.",
    fork: false,
    full_name: "fattah247/example-project",
    homepage: "https://example.com",
    html_url: "https://github.com/fattah247/example-project",
    language: "TypeScript",
    name: "example-project",
    private: false,
    pushed_at: "2026-07-10T12:00:00Z",
    topics: ["portfolio", "typescript", "tooling"],
    updated_at: "2026-08-20T12:00:00Z",
    ...overrides,
  };
}

const repositoriesOnly = (projects: GithubProject[]) => projects.filter((project) => project.kind !== "site");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getGithubProjects", () => {
  it("loads only public portfolio repositories and reduces README content to an excerpt", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchMock = vi.fn<(input: string | URL | Request, init?: NextRequestInit) => Promise<Response>>(async (input) => {
      const url = String(input);
      if (url.includes("/users/fattah247/repos")) {
        return new Response(JSON.stringify([
          repository(),
          repository({ name: "untagged", full_name: "fattah247/untagged", topics: ["typescript"] }),
          repository({ name: "forked", full_name: "fattah247/forked", fork: true }),
          repository({ name: "archived", full_name: "fattah247/archived", archived: true }),
        ]));
      }
      return new Response("# Example Project\n\nA repository README paragraph with enough detail to become the on-site project preview.\n\n## Setup\n\nRun the project locally.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGithubProjects();

    expect(result.source).toBe("github");
    const repositories = repositoriesOnly(result.projects);
    expect(repositories).toHaveLength(1);
    expect(repositories[0]).toMatchObject({
      displayName: "example project",
      homepageUrl: "https://example.com/",
      id: "example-project",
      topics: ["typescript", "tooling"],
      updatedLabel: "Jul 2026",
    });
    expect(repositories[0].readmeExcerpt).toContain("repository README paragraph");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestOptions = fetchMock.mock.calls[0][1];
    expect((requestOptions?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(requestOptions?.next?.revalidate).toBe(21_600);
  });

  it("bounds a refresh to eight projects and nine public API requests", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const repositories = Array.from({ length: 12 }, (_, index) => repository({
      full_name: `fattah247/project-${index}`,
      name: `project-${index}`,
      pushed_at: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
    }));
    const fetchMock = vi.fn<(input: string | URL | Request, init?: NextRequestInit) => Promise<Response>>(async (input) => {
      if (String(input).includes("/users/fattah247/repos")) return new Response(JSON.stringify(repositories));
      return new Response("# Project\n\nA public repository README paragraph with enough detail for the portfolio preview.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGithubProjects();

    expect(repositoriesOnly(result.projects)).toHaveLength(8);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    for (const call of fetchMock.mock.calls) {
      const requestOptions = call[1];
      expect((requestOptions?.headers as Record<string, string>).Authorization).toBeUndefined();
    }
  });

  it("lists only the live site when GitHub selects no repositories", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]))));

    const result = await getGithubProjects();

    expect(result.source).toBe("github");
    expect(result.projects.map((project) => project.id)).toEqual(["canoe"]);
  });

  it("returns the cached project index when GitHub is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    const result = await getGithubProjects();

    expect(result.source).toBe("fallback");
    // TrustGate Android is case 03, so it stays out of Side projects.
    expect(result.projects.map((project) => project.id)).toEqual([
      "canoe",
      "Stock-Triage",
      "SnapSort-iOS",
      "Xpire",
      "IoTifyHome",
    ]);
  });

  it("leads Side projects with canoe.quest as a live site whose source stays private", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([repository()]))));
    const live = await getGithubProjects();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const fallback = await getGithubProjects();

    for (const result of [live, fallback]) {
      expect(result.projects[0]).toMatchObject({ id: "canoe", kind: "site", homepageUrl: "https://canoe.quest", repositoryUrl: null, since: "2019" });
    }
    const site = live.projects[0];
    const images = [site.previewImageUrl, ...(site.showcase?.samples.map((sample) => sample.src) ?? [])];
    expect(images).toHaveLength(5);
    for (const image of images) expect(existsSync(resolve(process.cwd(), "public", image.slice(1))), image).toBe(true);
    for (const sample of site.showcase?.samples ?? []) expect(sample.href.startsWith("https://canoe.quest/")).toBe(true);
  });
});
