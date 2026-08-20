import { CounterfactualHome } from "./counterfactual-home";
import { getGithubProjects } from "../lib/github-projects";
import type { Conditions, ScenarioSlug } from "../lib/scenarios";

type PortfolioWorkspaceProps = {
  initialCaseConditions?: Conditions;
  initialCaseSlug?: ScenarioSlug;
  initialExperienceOpen?: boolean;
  initialGithubProjectId?: string;
};

export async function PortfolioWorkspace(props: PortfolioWorkspaceProps = {}) {
  const github = await getGithubProjects();
  return <CounterfactualHome {...props} githubProjects={github.projects} githubProjectsSource={github.source} />;
}
