"use client";

import { useMemo, useState } from "react";
import {
  groupProductLinks,
  indexProductLinks,
  searchProductLinks,
  type IndexedProductLink,
  type ProductLink,
} from "@/lib/product-links";

function ProductRow({ product }: { product: IndexedProductLink }) {
  return (
    <li>
      <a href={product.href} rel="sponsored noopener noreferrer" target="_blank">
        <span>{product.id}</span>
        <div>
          <small>Affiliate link</small>
          <strong className="product-link-name">{product.name}</strong>
          <p>{product.host}</p>
        </div>
        <b>Open link ↗</b>
      </a>
    </li>
  );
}

export function ProductLinksDirectory({ links }: { links: ProductLink[] }) {
  const [query, setQuery] = useState("");
  const products = useMemo(() => indexProductLinks(links), [links]);
  const results = useMemo(() => searchProductLinks(products, query), [products, query]);
  const groups = useMemo(() => groupProductLinks(products), [products]);
  const hasQuery = query.trim().length > 0;

  return (
    <section className="product-links-directory" aria-label="Affiliate product links">
      <div className="product-links-search">
        <label htmlFor="product-link-search">Find a product</label>
        <input
          autoComplete="off"
          id="product-link-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or ID"
          type="search"
          value={query}
        />
        {hasQuery ? <button onClick={() => setQuery("")} type="button">Clear</button> : null}
      </div>
      <p className="product-links-count" role="status">
        {hasQuery ? `${results.length} matching ${results.length === 1 ? "link" : "links"}` : `${products.length} ${products.length === 1 ? "link" : "links"}`}
      </p>

      {results.length ? (
        hasQuery ? (
          <ol className="product-links-list" aria-label="Matching product links">
            {results.map((product) => <ProductRow key={product.href} product={product} />)}
          </ol>
        ) : (
          <div className="product-link-groups">
            {groups.map((group) => (
              <section aria-labelledby={`product-group-${group.label}`} className="product-link-group" key={group.label}>
                <h2 id={`product-group-${group.label}`}>{group.label}</h2>
                <ol className="product-links-list">
                  {group.products.map((product) => <ProductRow key={product.href} product={product} />)}
                </ol>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="product-links-empty">
          <div>
            <p>{hasQuery ? `No link matches “${query.trim()}”.` : "No product links are published yet."}</p>
            <span>{hasQuery ? "Try another product name or ID." : "Add a name and affiliate URL to the product-links list."}</span>
          </div>
        </div>
      )}
    </section>
  );
}
