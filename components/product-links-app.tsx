"use client";

import { productLinks } from "../lib/product-links";
import { ProductLinksDirectory } from "./product-links-directory";

export function ProductLinksAppContent() {
  return (
    <div className="product-links-app-content">
      <header className="product-links-intro">
        <h1>Products I use</h1>
        <p>Marketplace links are affiliate links.</p>
      </header>
      <ProductLinksDirectory links={productLinks} />
    </div>
  );
}
