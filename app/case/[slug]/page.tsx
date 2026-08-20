import { notFound } from "next/navigation";
import { PortfolioHeader } from "@/components/portfolio-header";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";
import { getScenario, scenarios } from "@/lib/scenarios";

export function generateStaticParams() {
  return scenarios.map((scenario) => ({ slug: scenario.slug }));
}

type CasePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CasePage({ params, searchParams }: CasePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const scenario = getScenario(slug);
  if (!scenario) notFound();

  const initialConditions = { ...scenario.defaults };
  for (const control of scenario.controls) {
    const candidate = query[control.key];
    if (typeof candidate === "string" && control.options.some((option) => option.value === candidate)) {
      initialConditions[control.key] = candidate;
    }
  }

  return (
    <>
      <PortfolioHeader />
      <PortfolioWorkspace
        initialCaseConditions={initialConditions}
        initialCaseSlug={scenario.slug}
        key={scenario.slug}
      />
    </>
  );
}
