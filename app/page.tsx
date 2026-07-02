import { CounterfactualHome } from "@/components/counterfactual-home";
import { PortfolioHeader } from "@/components/portfolio-header";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialDesktop = params?.desktop === "1";

  return (
    <>
      <PortfolioHeader />
      <CounterfactualHome initialDesktop={initialDesktop} />
    </>
  );
}
