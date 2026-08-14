"use client";

import { useMemo, useRef, useState } from "react";
import {
  filterProductLinks,
  groupProductLinks,
  indexProductLinks,
  marketplaceDirectory,
  marketplaceLabel,
  searchProductLinks,
  type IndexedProductLink,
  type Marketplace,
  type ProductLink,
} from "../lib/product-links";

function MarketplaceMark({ marketplace }: { marketplace: Marketplace }) {
  if (marketplace === "shopee") return <svg aria-hidden="true" className="marketplace-mark" viewBox="0 0 24 24"><path d="M6 8.5h12l-1 11H7l-1-11Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /><path d="M14.5 12.2c-.5-.4-1.1-.6-1.8-.6-1 0-1.7.5-1.7 1.2 0 1.8 4 .9 4 3.1 0 .9-.9 1.6-2.2 1.6-.8 0-1.6-.3-2.2-.8" /></svg>;
  if (marketplace === "amazon") return <svg aria-hidden="true" className="marketplace-mark" viewBox="0 0 24 24"><path d="M8.2 10.1c.3-1.8 1.5-2.7 3.6-2.7 2.4 0 3.6 1.1 3.6 3.3v5.6c0 .7.2 1.3.6 1.8" /><path d="M15.3 13c-3.8-.2-5.7.7-5.7 2.6 0 1.3.9 2.1 2.3 2.1 1.5 0 2.6-.8 3.4-2.3" /><path d="M5 20c4.2 2 9.8 2 14-.5" /><path d="m17.4 18.6 1.9.2-.5 1.8" /></svg>;
  if (marketplace === "tokopedia") return <svg aria-hidden="true" className="marketplace-mark" viewBox="0 0 24 24"><path d="M5.5 9 7 5.5l3 2h4l3-2L18.5 9v8.5c-1.8 1.1-4 1.7-6.5 1.7s-4.7-.6-6.5-1.7V9Z" /><circle cx="9.4" cy="12" r="1.7" /><circle cx="14.6" cy="12" r="1.7" /><path d="m10.5 15 1.5 1 1.5-1" /></svg>;
  return <svg aria-hidden="true" className="marketplace-mark" viewBox="0 0 24 24"><path d="M14 4v11.2a3.8 3.8 0 1 1-3-3.7" /><path d="M14 4c.8 2.4 2.4 3.7 5 4" /></svg>;
}

function ProductRow({ product }: { product: IndexedProductLink }) {
  return (
    <li className="product-link-row">
      <span className="product-link-id">{product.id}</span>
      <div className="product-link-copy">
        <strong className="product-link-name">{product.name}</strong>
        <p>{product.offers.length} {product.offers.length === 1 ? "marketplace" : "marketplaces"}</p>
      </div>
      <div className="product-link-offers" aria-label={`Buy ${product.name}`}>
        {product.offers.map((offer) => (
          <a
            aria-label={`Open ${product.name} on ${marketplaceLabel(offer.marketplace)}`}
            className="product-marketplace-link"
            data-marketplace={offer.marketplace}
            href={offer.href}
            key={`${offer.marketplace}-${offer.href}`}
            rel="sponsored noopener noreferrer"
            target="_blank"
          >
            <MarketplaceMark marketplace={offer.marketplace} />
            <span>{marketplaceLabel(offer.marketplace)}</span>
            <b aria-hidden="true">↗</b>
          </a>
        ))}
      </div>
    </li>
  );
}

export function ProductLinksDirectory({ links }: { links: ProductLink[] }) {
  const [query, setQuery] = useState("");
  const [marketplace, setMarketplace] = useState<Marketplace | "all">("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const products = useMemo(() => indexProductLinks(links), [links]);
  const availableMarketplaces = useMemo(() => marketplaceDirectory.filter((entry) => (
    products.some((product) => product.offers.some((offer) => offer.marketplace === entry.id))
  )), [products]);
  const results = useMemo(() => (
    filterProductLinks(searchProductLinks(products, query), marketplace)
  ), [marketplace, products, query]);
  const hasQuery = query.trim().length > 0;
  const hasFilter = marketplace !== "all";
  const visibleGroups = useMemo(() => groupProductLinks(results), [results]);
  const visibleOfferCount = results.reduce((total, product) => total + product.offers.length, 0);

  return (
    <section className="product-links-directory" aria-label="Affiliate product links">
      <div className="product-links-search">
        <label htmlFor="product-link-search">Find a product</label>
        <input
          aria-controls="product-link-results"
          autoComplete="off"
          id="product-link-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !query) return;
            event.preventDefault();
            setQuery("");
          }}
          placeholder="Search product or marketplace"
          ref={searchRef}
          type="search"
          value={query}
        />
        {hasQuery ? <button onClick={() => {
          setQuery("");
          searchRef.current?.focus();
        }} type="button">Clear</button> : null}
      </div>
      {availableMarketplaces.length > 1 ? <nav aria-label="Filter product links by marketplace" className="product-marketplace-filter">
        <button aria-pressed={marketplace === "all"} onClick={() => setMarketplace("all")} type="button">All</button>
        {availableMarketplaces.map((entry) => <button aria-pressed={marketplace === entry.id} key={entry.id} onClick={() => setMarketplace(entry.id)} type="button">
          <MarketplaceMark marketplace={entry.id} />
          <span>{entry.label}</span>
        </button>)}
      </nav> : null}
      <p className="product-links-count" role="status">
        {`${results.length} ${results.length === 1 ? "product" : "products"} · ${visibleOfferCount} ${visibleOfferCount === 1 ? "link" : "links"}`}
      </p>

      {results.length ? (
        hasQuery || hasFilter ? (
          <ol className="product-links-list" aria-label="Matching product links" id="product-link-results">
            {results.map((product) => <ProductRow key={product.id} product={product} />)}
          </ol>
        ) : (
          <div className="product-link-groups" id="product-link-results">
            {visibleGroups.map((group) => (
              <section aria-labelledby={`product-group-${group.label}`} className="product-link-group" key={group.label}>
                <h2 id={`product-group-${group.label}`}>{group.label}</h2>
                <ol className="product-links-list">
                  {group.products.map((product) => <ProductRow key={product.id} product={product} />)}
                </ol>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="product-links-empty" id="product-link-results">
          <div>
            <p>{hasQuery ? `No product matches “${query.trim()}”.` : hasFilter ? `No ${marketplaceLabel(marketplace)} links are published yet.` : "No product links are published yet."}</p>
            <span>{hasQuery ? "Try another product name, ID, or marketplace." : hasFilter ? "Choose another marketplace." : "Add a product and marketplace offer to the product-links list."}</span>
          </div>
        </div>
      )}
    </section>
  );
}
