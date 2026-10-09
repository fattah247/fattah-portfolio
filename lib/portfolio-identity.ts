/** Shared professional identity. Shells and documents must not maintain copies. */
export const portfolioIdentity = {
  name: "Muhammad A. Fattah",
  role: "Software Engineer",
  location: "Indonesia",
  focus: "Android POS and merchant payment systems",
  github: "https://github.com/fattah247",
  cv: "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf",
  email: "fattahmuhammad17@gmail.com",
  linkedin: "https://www.linkedin.com/in/muhammad24fattah",
  whatsapp: "https://wa.me/6281944242422",
  whatsappDisplay: "0819 4424 2422",
} as const;

/** A link's host and path without the protocol, for showing a profile handle once. */
export function displayHandle(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** Document titles follow the route metadata template so in-app URL changes keep the tab honest. */
export const portfolioTitle = {
  default: `${portfolioIdentity.name} — ${portfolioIdentity.role}`,
  template: `%s — ${portfolioIdentity.name}`,
  for: (label?: string | null) => label ? portfolioTitle.template.replace("%s", label) : portfolioTitle.default,
};
