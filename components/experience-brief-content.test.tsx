import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { experience } from "../lib/content";
import { getGithubProjects } from "../lib/github-projects";
import { ExperienceBriefContent } from "./experience-brief-content";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Experience role history", () => {
  it("describes the founder role and links out to canoe.quest with a glimpse of its work", () => {
    render(<ExperienceBriefContent onOpenContact={vi.fn()} onOpenWork={vi.fn()} />);

    const founder = screen.getByRole("heading", { name: "Founder" }).closest("article")!;
    expect(founder.getAttribute("data-current")).toBe("true");
    expect(within(founder).getByRole("link", { name: "Visit canoe.quest , opens in a new tab" }).getAttribute("href")).toBe("https://canoe.quest");
    expect(within(within(founder).getByRole("list", { name: "Work on canoe.quest" })).getAllByRole("link")).toHaveLength(4);
  });

  it("names no clients: the founder role says what the founder does", async () => {
    const { container } = render(<ExperienceBriefContent onOpenContact={vi.fn()} onOpenWork={vi.fn()} />);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const site = (await getGithubProjects()).projects.find((project) => project.id === "canoe")!;

    // "Client" alone is the system-scope row for client-side work; no customer is named anywhere.
    expect(container.textContent).not.toMatch(/CITA/i);
    const canoe = JSON.stringify(experience.find((item) => item.company === "Canoe"));
    for (const text of [canoe, site.description, site.readmeExcerpt]) expect(text).not.toMatch(/CITA|client/i);
  });
});
