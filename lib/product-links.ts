export type Marketplace = "shopee" | "tokopedia" | "tiktok" | "amazon";

export type ProductOffer = {
  href: string;
  marketplace: Marketplace;
  preferred?: boolean;
};

export type ProductLink = {
  aliases?: string[];
  id: string;
  name: string;
  offers: ProductOffer[];
};

export type IndexedProductOffer = ProductOffer & {
  host: string;
};

export type IndexedProductLink = Omit<ProductLink, "offers"> & {
  offers: IndexedProductOffer[];
};

export type ProductLinkGroup = {
  label: string;
  products: IndexedProductLink[];
};

function searchable(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_-]+/g, "");
}

export const marketplaceDirectory = [
  { id: "shopee", label: "Shopee" },
  { id: "tokopedia", label: "Tokopedia" },
  { id: "tiktok", label: "TikTok Shop" },
  { id: "amazon", label: "Amazon" },
] as const satisfies ReadonlyArray<{ id: Marketplace; label: string }>;

export function marketplaceLabel(marketplace: Marketplace) {
  return marketplaceDirectory.find((item) => item.id === marketplace)?.label ?? marketplace;
}

function hostForLink(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export function indexProductLinks(links: ProductLink[]): IndexedProductLink[] {
  return [...links]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
    .map((product) => ({
      ...product,
      offers: [...product.offers]
        .sort((left, right) => (
          Number(Boolean(right.preferred)) - Number(Boolean(left.preferred))
          || marketplaceDirectory.findIndex((item) => item.id === left.marketplace)
            - marketplaceDirectory.findIndex((item) => item.id === right.marketplace)
        ))
        .map((offer) => ({ ...offer, host: hostForLink(offer.href) })),
    }));
}

export function searchProductLinks(products: IndexedProductLink[], query: string) {
  const term = searchable(query.trim());
  if (!term) return products;
  return products.filter((product) => (
    searchable(product.name).includes(term)
    || searchable(product.id).includes(term)
    || product.aliases?.some((alias) => searchable(alias).includes(term))
    || product.offers.some((offer) => (
      searchable(marketplaceLabel(offer.marketplace)).includes(term)
      || searchable(offer.host).includes(term)
    ))
  ));
}

export function filterProductLinks(products: IndexedProductLink[], marketplace: Marketplace | "all") {
  if (marketplace === "all") return products;
  return products.flatMap((product) => {
    const offers = product.offers.filter((offer) => offer.marketplace === marketplace);
    return offers.length ? [{ ...product, offers }] : [];
  });
}

export function groupProductLinks(products: IndexedProductLink[]): ProductLinkGroup[] {
  const groups = new Map<string, IndexedProductLink[]>();
  for (const product of products) {
    const initial = product.name.trim().charAt(0).toLocaleUpperCase();
    const label = /^[A-Z]$/.test(initial) ? initial : "#";
    groups.set(label, [...(groups.get(label) ?? []), product]);
  }
  return [...groups].map(([label, groupedProducts]) => ({ label, products: groupedProducts }));
}

// Add another marketplace by appending an offer to the existing product.
// Supported marketplace values: shopee, tokopedia, tiktok, and amazon.
export const productLinks = [
  { id: "PL-001", name: "MacBook Pro M1", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/4AyN7QPPWa", preferred: true }] },
  { id: "PL-002", name: "iPhone 17 Pro", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/60Q1JBc5iy", preferred: true }] },
  { id: "PL-003", name: "Kepala Charger UGREEN", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/9UztTiazCc", preferred: true }] },
  { id: "PL-004", name: "Kepala Charger Dual Port UGREEN", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/7prfUt16xt", preferred: true }] },
  { id: "PL-005", name: "DAC USB-C FIIO JA11", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/BSEMhKU7C", preferred: true }] },
  { id: "PL-006", name: "Earphone KINERA WYVERN", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/4LHnKPWhEk", preferred: true }] },
  { id: "PL-007", name: "Mouse Rexus Flow QZ30", offers: [{ marketplace: "shopee", href: "https://s.shopee.co.id/70IYVPHEXc", preferred: true }] },
  // { id: "PL-008", name: "Product name", offers: [{ marketplace: "tokopedia", href: "https://affiliate.example/product" }] },
] satisfies ProductLink[];
