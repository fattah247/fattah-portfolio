import type { Metadata } from "next";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";
import { PortfolioHeader } from "@/components/portfolio-header";

export const metadata: Metadata = {
  title: "Product links",
  description: "Products and tools used by Muhammad A. Fattah.",
};

export default function ProductLinksPage() {
  return <><PortfolioHeader /><PortfolioWorkspace initialProductsOpen /></>;
}
