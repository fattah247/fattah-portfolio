import { CounterfactualHome } from "./counterfactual-home";
import type { GithubProjectsPayload } from "../lib/github-projects";
import type { Conditions, ScenarioSlug } from "../lib/scenarios";

type PortfolioWorkspaceProps = {
  initialCaseConditions?: Conditions;
  initialCaseSlug?: ScenarioSlug;
  /** `?technical=1` on a case URL, read on the server so the first render matches the client's. */
  initialCaseTechnical?: boolean;
  initialExperienceOpen?: boolean;
  initialProductsOpen?: boolean;
  initialGithubProjectId?: string;
  github?: GithubProjectsPayload;
};

export function PortfolioWorkspace({ github, ...props }: PortfolioWorkspaceProps = {}) {
  return <CounterfactualHome {...props} githubProjects={github?.projects} githubProjectsSource={github?.source} />;
}
