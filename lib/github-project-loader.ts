"use server";

import { getGithubProjects } from "./github-projects";

/** Secondary data is requested when Projects opens, never on the Home critical path. */
export async function loadGithubProjects() {
  return getGithubProjects();
}
