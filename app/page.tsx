import { PortfolioHeader } from "@/components/portfolio-header";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";
import { getGithubProjects } from "@/lib/github-projects";

export default async function Home() {
  const github = await getGithubProjects();

  return (
    <>
      <PortfolioHeader />
      <PortfolioWorkspace github={github} />
    </>
  );
}
