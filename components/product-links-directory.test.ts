import { describe, expect, it } from "vitest";
import { groupProductLinks, indexProductLinks, searchProductLinks } from "../lib/product-links";

const links = [
  { name: "Zebra Stand", href: "https://example.com/zebra" },
  { name: "Alpha Cable", href: "https://shop.example/alpha" },
];

describe("product link directory", () => {
  it("sorts links by name and assigns generated IDs", () => {
    expect(indexProductLinks(links)).toEqual([
      { name: "Alpha Cable", href: "https://shop.example/alpha", host: "shop.example", id: "PL-001" },
      { name: "Zebra Stand", href: "https://example.com/zebra", host: "example.com", id: "PL-002" },
    ]);
  });

  it("searches by product name or generated ID", () => {
    const products = indexProductLinks(links);

    expect(searchProductLinks(products, "alpha").map((product) => product.name)).toEqual(["Alpha Cable"]);
    expect(searchProductLinks(products, "PL 002").map((product) => product.name)).toEqual(["Zebra Stand"]);
  });

  it("groups the alphabetical directory by initial", () => {
    const groups = groupProductLinks(indexProductLinks(links));

    expect(groups.map((group) => [group.label, group.products.map((product) => product.name)])).toEqual([
      ["A", ["Alpha Cable"]],
      ["Z", ["Zebra Stand"]],
    ]);
  });
});
