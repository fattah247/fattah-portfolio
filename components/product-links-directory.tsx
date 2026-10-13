"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowIcon, MarketplaceIcon } from "./icons";
import { useOptionalWorkspaceManager } from "./workspace-manager";
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
  return <MarketplaceIcon marketplace={marketplace} />;
}

const letterIndexThreshold = 12;

function ProductRow({ product }: { product: IndexedProductLink }) {
  return (
    <li className="product-link-row">
      <span className="product-link-id">{product.id}</span>
      <div className="product-link-copy">
        <strong className="product-link-name">{product.name}</strong>
      </div>
      <div className="product-link-offers" role="group" aria-label={`Buy ${product.name}`}>
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
            <b aria-hidden="true"><ArrowIcon /></b>
          </a>
        ))}
      </div>
    </li>
  );
}

export function ProductLinksDirectory({ links }: { links: ProductLink[] }) {
  const workspace = useOptionalWorkspaceManager();
  const [query, setQuery] = useState(() => String(workspace?.readDocumentState("products", "directory")?.data?.query ?? ""));
  const [marketplace, setMarketplace] = useState<Marketplace | "all">(() => {
    const saved = workspace?.readDocumentState("products", "directory")?.data?.marketplace;
    return marketplaceDirectory.some((entry) => entry.id === saved) ? saved as Marketplace : "all";
  });
  const writeDocumentState = workspace?.writeDocumentState;
  useEffect(() => {
    writeDocumentState?.("products", "directory", { data: { query, marketplace } });
  }, [marketplace, query, writeDocumentState]);
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
          enterKeyHint="search"
          id="product-link-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // The results are already live; on a touch screen the keyboard's Search key just
            // puts the keyboard away so the list can be read.
            if (event.key === "Enter" && window.matchMedia("(pointer: coarse)").matches) { event.currentTarget.blur(); return; }
            if (event.key !== "Escape" || !query) return;
            // Clearing the field consumes Escape; the window stays open.
            event.preventDefault();
            event.stopPropagation();
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
      {availableMarketplaces.length > 1 ? <div role="group" aria-label="Filter product links by marketplace" className="product-marketplace-filter">
        <button aria-pressed={marketplace === "all"} onClick={() => setMarketplace("all")} type="button">All</button>
        {availableMarketplaces.map((entry) => <button aria-pressed={marketplace === entry.id} key={entry.id} onClick={() => setMarketplace(entry.id)} type="button">
          <MarketplaceMark marketplace={entry.id} />
          <span>{entry.label}</span>
        </button>)}
      </div> : null}
      <p className="product-links-count" role="status">
        {`${results.length} ${results.length === 1 ? "product" : "products"} · ${visibleOfferCount} ${visibleOfferCount === 1 ? "link" : "links"}`}
      </p>

      {results.length ? (
        // An A–Z index only helps once the catalogue is long; a short one reads as one list.
        hasQuery || hasFilter || results.length <= letterIndexThreshold ? (
          <ol className="product-links-list" aria-label={hasQuery || hasFilter ? "Matching product links" : "Product links"} id="product-link-results">
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
            {hasQuery || hasFilter ? <span>{hasQuery ? "Try another product name, ID, or marketplace." : "Choose another marketplace."}</span> : null}
          </div>
        </div>
      )}
    </section>
  );
}
