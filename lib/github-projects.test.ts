import { afterEach, describe, expect, it, vi } from "vitest";
import { getGithubProjects } from "./github-projects";

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
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({
      displayName: "example project",
      homepageUrl: "https://example.com/",
      id: "example-project",
      topics: ["typescript", "tooling"],
      updatedLabel: "Jul 2026",
    });
    expect(result.projects[0].readmeExcerpt).toContain("repository README paragraph");
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

    expect(result.projects).toHaveLength(8);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    for (const call of fetchMock.mock.calls) {
      const requestOptions = call[1];
      expect((requestOptions?.headers as Record<string, string>).Authorization).toBeUndefined();
    }
  });

  it("treats a successful empty selection as an honest empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]))));

    const result = await getGithubProjects();

    expect(result).toEqual({ projects: [], source: "github" });
  });

  it("returns the cached project index when GitHub is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    const result = await getGithubProjects();

    expect(result.source).toBe("fallback");
    expect(result.projects.map((project) => project.id)).toEqual([
      "trustgate-android",
      "Stock-Triage",
      "SnapSort-iOS",
      "Xpire",
      "IoTifyHome",
    ]);
  });
});
