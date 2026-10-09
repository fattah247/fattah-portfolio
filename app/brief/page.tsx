import type { Metadata } from "next";
import { portfolioApp } from "@/components/app-registry";
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
export const metadata: Metadata = { title: portfolioApp("experience").documentTitle, description: "Muhammad A. Fattah’s role history, engineering scope, and downloadable CV." };
