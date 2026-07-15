import type { Metadata } from "next";
import { PortfolioHeader } from "@/components/portfolio-header";
import { ProductLinksDirectory } from "@/components/product-links-directory";
import { productLinks } from "@/lib/product-links";

export const metadata: Metadata = {
  title: "Product links",
  description: "Products and tools used by Muhammad A. Fattah.",
};

export default function ProductLinksPage() {
  return (
    <>
      <PortfolioHeader />
      <main className="product-links-page">
        <header className="product-links-intro">
          <p>Product links</p>
          <h1>Products I use.</h1>
          <span>Browse alphabetically or search by product name and ID.</span>
        </header>

        <ProductLinksDirectory links={productLinks} />
      </main>
    </>
  );
}
