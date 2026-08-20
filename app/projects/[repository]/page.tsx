import { notFound } from "next/navigation";
import { PortfolioHeader } from "@/components/portfolio-header";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";
import { getGithubProjects } from "@/lib/github-projects";

type GithubProjectPageProps = {
  params: Promise<{ repository: string }>;
};

export default async function GithubProjectPage({ params }: GithubProjectPageProps) {
  const { repository } = await params;
  const github = await getGithubProjects();
  const project = github.projects.find((item) => item.id.toLocaleLowerCase() === repository.toLocaleLowerCase());
  if (!project) notFound();

  return (
    <>
      <PortfolioHeader />
      <PortfolioWorkspace initialGithubProjectId={project.id} />
    </>
  );
}
