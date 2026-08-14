import { CounterfactualHome } from "@/components/counterfactual-home";
import { PortfolioHeader } from "@/components/portfolio-header";

export default function BriefPage() {
  return (
    <>
      <PortfolioHeader />
      <CounterfactualHome initialExperienceView="full-brief" />
    </>
  );
}
