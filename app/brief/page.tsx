import { PortfolioHeader } from "@/components/portfolio-header";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";

export default function BriefPage() {
  return (
    <>
      <PortfolioHeader />
      <PortfolioWorkspace initialExperienceOpen />
    </>
  );
}
