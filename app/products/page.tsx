import type { Metadata } from "next";
import { portfolioApp } from "@/components/app-registry";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";
import { PortfolioHeader } from "@/components/portfolio-header";

export const metadata: Metadata = {
  title: portfolioApp("products").documentTitle,
  description: "Products and tools used by Muhammad A. Fattah.",
};

export default function ProductLinksPage() {
  return <><PortfolioHeader /><PortfolioWorkspace initialProductsOpen /></>;
}
