export type ProductLink = {
  href: string;
  name: string;
};

export type IndexedProductLink = ProductLink & {
  host: string;
  id: string;
};

export type ProductLinkGroup = {
  label: string;
  products: IndexedProductLink[];
};

function searchable(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_-]+/g, "");
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
    .map((product, index) => ({
      ...product,
      host: hostForLink(product.href),
      id: `PL-${String(index + 1).padStart(3, "0")}`,
    }));
}

export function searchProductLinks(products: IndexedProductLink[], query: string) {
  const term = searchable(query.trim());
  if (!term) return products;
  return products.filter((product) => (
    searchable(product.name).includes(term) || searchable(product.id).includes(term)
  ));
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

// Add affiliate links here. The directory generates IDs and sorts by name.
export const productLinks = [
  { name: "MacBook Pro M1", href: "https://s.shopee.co.id/4AyN7QPPWa" },
  { name: "iPhone 17 Pro", href: "https://s.shopee.co.id/60Q1JBc5iy" },
  { name: "Kepala Charger UGREEN", href: "https://s.shopee.co.id/9UztTiazCc" },
  { name: "Kepala Charger Dual Port UGREEN", href: "https://s.shopee.co.id/7prfUt16xt" },
  { name: "DAC USB-C FIIO JA11", href: "https://s.shopee.co.id/BSEMhKU7C" },
  { name: "Earphone KINERA WYVERN", href: "https://s.shopee.co.id/4LHnKPWhEk" },
  { name: "Mouse Rexus Flow QZ30", href: "https://s.shopee.co.id/70IYVPHEXc" },
  // { name: "Product name", href: "https://affiliate.example/product" },
] satisfies ProductLink[];
