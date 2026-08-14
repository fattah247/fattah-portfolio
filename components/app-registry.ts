import type { PortfolioAppId } from "./workspace-manager";

export type PortfolioAppDefinition = {
  description: string;
  glyph: string;
  id: PortfolioAppId;
  label: string;
  shortLabel?: string;
};

/** One registry keeps launcher, taskbar, shelf, and Recents ownership aligned. */
export const portfolioApps: PortfolioAppDefinition[] = [
  { id: "work", label: "Work", glyph: "W", description: "Engineering cases and evidence" },
  { id: "experience", label: "Experience", glyph: "CV", description: "Role history and résumé" },
  { id: "contact", label: "Contact", glyph: "@", description: "Email and public profile" },
  { id: "products", label: "Product Links", shortLabel: "Products", glyph: "PL", description: "Tools and products I use" },
];

export function portfolioApp(id: PortfolioAppId) {
  return portfolioApps.find((app) => app.id === id)!;
}
