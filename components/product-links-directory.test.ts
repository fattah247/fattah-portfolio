import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { groupProductLinks, indexProductLinks, searchProductLinks } from "../lib/product-links";
import { ProductLinksDirectory } from "./product-links-directory";

const links = [
  { id: "PL-002", name: "Zebra Stand", offers: [{ marketplace: "amazon" as const, href: "https://amazon.example/zebra" }] },
  {
    aliases: ["USB-C cable"],
    id: "PL-001",
    name: "Alpha Cable",
    offers: [
      { marketplace: "tokopedia" as const, href: "https://tokopedia.example/alpha" },
      { marketplace: "shopee" as const, href: "https://shopee.example/alpha", preferred: true },
      { marketplace: "tiktok" as const, href: "https://tiktok.example/alpha" },
    ],
  },
];

describe("product link directory", () => {
  afterEach(cleanup);

  it("sorts products by name while preserving stable IDs and ordering marketplace offers", () => {
    expect(indexProductLinks(links)).toEqual([
      {
        aliases: ["USB-C cable"],
        id: "PL-001",
        name: "Alpha Cable",
        offers: [
          { marketplace: "shopee", href: "https://shopee.example/alpha", host: "shopee.example", preferred: true },
          { marketplace: "tokopedia", href: "https://tokopedia.example/alpha", host: "tokopedia.example" },
          { marketplace: "tiktok", href: "https://tiktok.example/alpha", host: "tiktok.example" },
        ],
      },
      { id: "PL-002", name: "Zebra Stand", offers: [{ marketplace: "amazon", href: "https://amazon.example/zebra", host: "amazon.example" }] },
    ]);
  });

  it("searches by product name, stable ID, alias, host, or marketplace", () => {
    const products = indexProductLinks(links);

    expect(searchProductLinks(products, "alpha").map((product) => product.name)).toEqual(["Alpha Cable"]);
    expect(searchProductLinks(products, "PL 002").map((product) => product.name)).toEqual(["Zebra Stand"]);
    expect(searchProductLinks(products, "usb c").map((product) => product.name)).toEqual(["Alpha Cable"]);
    expect(searchProductLinks(products, "TikTok").map((product) => product.name)).toEqual(["Alpha Cable"]);
    expect(searchProductLinks(products, "amazon.example").map((product) => product.name)).toEqual(["Zebra Stand"]);
  });

  it("groups the alphabetical directory by initial", () => {
    const groups = groupProductLinks(indexProductLinks(links));

    expect(groups.map((group) => [group.label, group.products.map((product) => product.name)])).toEqual([
      ["A", ["Alpha Cable"]],
      ["Z", ["Zebra Stand"]],
    ]);
  });

  it("lists a short catalogue alphabetically and indexes a long one by initial", () => {
    render(createElement(ProductLinksDirectory, { links }));
    expect(screen.queryByRole("heading", { name: "A" })).toBeNull();
    expect(Array.from(screen.getByRole("list", { name: "Product links" }).querySelectorAll(".product-link-name")).map((item) => item.textContent)).toEqual(["Alpha Cable", "Zebra Stand"]);
    cleanup();

    const longCatalogue = Array.from({ length: 13 }, (_, index) => ({
      id: `PL-${String(index + 1).padStart(3, "0")}`,
      name: `${String.fromCharCode(65 + index)} product`,
      offers: [{ marketplace: "shopee" as const, href: `https://shopee.example/${index}` }],
    }));
    render(createElement(ProductLinksDirectory, { links: longCatalogue }));
    expect(screen.getByRole("heading", { name: "A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "M" })).toBeTruthy();
  });

  it("supports ID search, clear, and an honest empty result", () => {
    render(createElement(ProductLinksDirectory, { links }));

    const search = screen.getByRole("searchbox", { name: "Find a product" });
    fireEvent.change(search, { target: { value: "PL-002" } });
    expect(screen.getByText("Zebra Stand")).toBeTruthy();
    expect(screen.queryByText("Alpha Cable")).toBeNull();

    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText("No product matches “missing”.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Alpha Cable")).toBeTruthy();
  });

  it("groups marketplace destinations under one product with recognizable labels and filtering", () => {
    render(createElement(ProductLinksDirectory, { links }));

    expect(screen.getByRole("link", { name: "Open Alpha Cable on Shopee" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Alpha Cable on Tokopedia" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Alpha Cable on TikTok Shop" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Zebra Stand on Amazon" })).toBeTruthy();
    expect(screen.getByText("2 products · 4 links")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Amazon" }));
    expect(screen.getByText("Zebra Stand")).toBeTruthy();
    expect(screen.queryByText("Alpha Cable")).toBeNull();
    expect(screen.getByText("1 product · 1 link")).toBeTruthy();
  });

  it("clears a search with Escape without moving keyboard focus", () => {
    render(createElement(ProductLinksDirectory, { links }));
    const search = screen.getByRole("searchbox", { name: "Find a product" });
    search.focus();
    fireEvent.change(search, { target: { value: "missing" } });
    fireEvent.keyDown(search, { key: "Escape" });

    expect((search as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search);
    expect(screen.getByText("Alpha Cable")).toBeTruthy();
  });
});
