import type { PortfolioAppId } from "./workspace-manager";

export type PortfolioAppDefinition = {
  defaultDocumentId: string;
  description: string;
  /** Route metadata title for the app's own document; undefined keeps the site default. */
  documentTitle?: string;
  href: string;
  id: PortfolioAppId;
  label: string;
  shortLabel?: string;
};

/** One registry keeps launcher, taskbar, shelf, and Recents ownership aligned. */
export const portfolioApps: PortfolioAppDefinition[] = [
  { id: "work", label: "Projects", description: "Engineering cases and evidence", defaultDocumentId: "work", href: "/#selected-work" },
  { id: "experience", label: "Experience", description: "Role history and CV", defaultDocumentId: "brief", href: "/brief", documentTitle: "Experience and CV" },
  { id: "contact", label: "Contact", description: "Email and public profile", defaultDocumentId: "contact", href: "/" },
  { id: "products", label: "Product Links", shortLabel: "Products", description: "Tools and products I use", defaultDocumentId: "products", href: "/products", documentTitle: "Product links" },
];

export function portfolioApp(id: PortfolioAppId) {
  return portfolioApps.find((app) => app.id === id)!;
}
