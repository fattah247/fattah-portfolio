const githubOwner = "fattah247";
const githubApiVersion = "2022-11-28";
const portfolioTopic = "portfolio";
const maxLiveProjects = 8;
const refreshSeconds = 6 * 60 * 60;

export type GithubProject = {
  description: string;
  displayName: string;
  homepageUrl: string | null;
  id: string;
  language: string | null;
  previewImageUrl: string;
  readmeExcerpt: string;
  repositoryUrl: string;
  topics: string[];
  updatedAt: string;
  updatedLabel: string;
};

export type GithubProjectsPayload = {
  projects: GithubProject[];
  source: "github" | "fallback";
};

type GithubRepositoryResponse = {
  archived: boolean;
  description: string | null;
  fork: boolean;
  full_name: string;
  homepage: string | null;
  html_url: string;
  language: string | null;
  name: string;
  private: boolean;
  pushed_at: string | null;
  topics?: string[];
  updated_at: string;
};

const fallbackProjects: GithubProject[] = [
  {
    description: "Android security lab for device-risk checks, sensitive action gating, request signing, secure local storage, and audit-style security events.",
    displayName: "TrustGate Android",
    homepageUrl: null,
    id: "trustgate-android",
    language: "Kotlin",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/trustgate-android",
    readmeExcerpt: "An Android security lab that combines device-risk checks, request signing, secure local storage, and audit-oriented security events.",
    repositoryUrl: "https://github.com/fattah247/trustgate-android",
    topics: [],
    updatedAt: "2026-05-31T01:06:25Z",
    updatedLabel: "May 2026",
  },
  {
    description: "IDX filing analysis automation system.",
    displayName: "Stock Triage",
    homepageUrl: null,
    id: "Stock-Triage",
    language: "Python",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/Stock-Triage",
    readmeExcerpt: "A local workflow for collecting public IDX filings, preserving evidence, applying deterministic rules, and reviewing company-level signals.",
    repositoryUrl: "https://github.com/fattah247/Stock-Triage",
    topics: [],
    updatedAt: "2026-05-20T07:12:21Z",
    updatedLabel: "May 2026",
  },
  {
    description: "An iOS app to review, organize, and clean up a photo library with swipe actions, smart analysis, and stats widgets.",
    displayName: "SnapSort iOS",
    homepageUrl: null,
    id: "SnapSort-iOS",
    language: "Swift",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/SnapSort-iOS",
    readmeExcerpt: "Review and organize a photo library through a SwiftUI application with photo analysis, swipe actions, Core Data, and a companion widget.",
    repositoryUrl: "https://github.com/fattah247/SnapSort-iOS",
    topics: ["ios", "swiftui", "photo-management"],
    updatedAt: "2026-06-10T14:50:07Z",
    updatedLabel: "Jun 2026",
  },
  {
    description: "Track item expiration dates and get reminders before they expire.",
    displayName: "Xpire",
    homepageUrl: null,
    id: "Xpire",
    language: "JavaScript",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/Xpire",
    readmeExcerpt: "Xpire helps households track perishable items, highlight what will expire soon, and remove stale inventory quickly.",
    repositoryUrl: "https://github.com/fattah247/Xpire",
    topics: ["productivity", "reminders", "web-app"],
    updatedAt: "2026-02-16T21:41:30Z",
    updatedLabel: "Feb 2026",
  },
  {
    description: "Smart home control app for managing and automating connected IoT devices.",
    displayName: "IoTifyHome",
    homepageUrl: null,
    id: "IoTifyHome",
    language: "JavaScript",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/IoTifyHome",
    readmeExcerpt: "A smart-home dashboard with local controls, user authentication, cloud state synchronization, automation rules, and command routing to a device bridge.",
    repositoryUrl: "https://github.com/fattah247/IoTifyHome",
    topics: ["automation", "iot", "smart-home"],
    updatedAt: "2026-02-16T21:37:39Z",
    updatedLabel: "Feb 2026",
  },
];

function githubHeaders(accept = "application/vnd.github+json") {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "fattah-portfolio",
    "X-GitHub-Api-Version": githubApiVersion,
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

function displayName(name: string) {
  const knownNames: Record<string, string> = {
    "SnapSort-iOS": "SnapSort iOS",
    "Stock-Triage": "Stock Triage",
    "trustgate-android": "TrustGate Android",
  };
  return knownNames[name] ?? name.replaceAll("-", " ");
}

function updatedLabel(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function cleanReadme(markdown: string, fallback: string) {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph
      .replace(/^#{1,6}\s+.*$/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .replace(/\s+/g, " ")
      .trim())
    .find((paragraph) => paragraph.length >= 48 && !paragraph.startsWith("http"));
  const excerpt = prose || fallback;
  return excerpt.length > 280 ? `${excerpt.slice(0, 277).trimEnd()}…` : excerpt;
}

function safeHomepage(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function readmeExcerpt(repository: GithubRepositoryResponse) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository.full_name}/readme`, {
      headers: githubHeaders("application/vnd.github.raw+json"),
      next: { revalidate: refreshSeconds },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return repository.description ?? "Public repository on GitHub.";
    return cleanReadme(await response.text(), repository.description ?? "Public repository on GitHub.");
  } catch {
    return repository.description ?? "Public repository on GitHub.";
  }
}

function isPortfolioRepository(repository: GithubRepositoryResponse) {
  return !repository.private
    && !repository.fork
    && !repository.archived
    && repository.topics?.includes(portfolioTopic);
}

export async function getGithubProjects(): Promise<GithubProjectsPayload> {
  try {
    const response = await fetch(`https://api.github.com/users/${githubOwner}/repos?type=owner&sort=updated&direction=desc&per_page=100`, {
      headers: githubHeaders(),
      next: { revalidate: refreshSeconds },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const repositories = (await response.json() as GithubRepositoryResponse[])
      .filter(isPortfolioRepository)
      .sort((left, right) => Date.parse(right.pushed_at ?? right.updated_at) - Date.parse(left.pushed_at ?? left.updated_at))
      .slice(0, maxLiveProjects);
    const projects: GithubProject[] = [];
    for (const repository of repositories) {
      const activityDate = repository.pushed_at ?? repository.updated_at;
      projects.push({
        description: repository.description ?? "Public repository on GitHub.",
        displayName: displayName(repository.name),
        homepageUrl: safeHomepage(repository.homepage),
        id: repository.name,
        language: repository.language,
        previewImageUrl: `https://opengraph.githubassets.com/portfolio/${repository.full_name}`,
        readmeExcerpt: await readmeExcerpt(repository),
        repositoryUrl: repository.html_url,
        topics: (repository.topics ?? []).filter((topic) => topic !== portfolioTopic).slice(0, 4),
        updatedAt: activityDate,
        updatedLabel: updatedLabel(activityDate),
      });
    }
    return { projects, source: "github" };
  } catch {
    return { projects: fallbackProjects.map((project) => ({ ...project, topics: [...project.topics] })), source: "fallback" };
  }
}
