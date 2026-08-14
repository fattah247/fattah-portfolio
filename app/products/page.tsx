import type { Metadata } from "next";
import { PortfolioHeader } from "@/components/portfolio-header";
import { ProductLinksRouteWindow } from "@/components/product-links-app";

export const metadata: Metadata = {
  title: "Product links",
  description: "Products and tools used by Muhammad A. Fattah.",
};

export default function ProductLinksPage() {
  return (
    <>
      <PortfolioHeader />
      <ProductLinksRouteWindow />
    </>
  );
}
