/**
 * canoe.quest, the site of Canoe, the studio founded in 2019. Every image is a page on canoe.quest
 * captured as it is published. The samples are the studio's own concept pieces (canoe.quest labels
 * them as such); client work is never shown here.
 */
export type ShowcaseSample = {
  alt: string;
  caption: string;
  href: string;
  /** "tall" pages are captured at phone size, the way guests open them; "wide" at desktop size. */
  shape: "tall" | "wide";
  src: string;
};

export type SiteShowcase = {
  cover: { alt: string; src: string };
  href: string;
  label: string;
  samples: ShowcaseSample[];
};

export const canoeShowcase: SiteShowcase = {
  cover: { alt: "The canoe.quest home page: “What you can not, we can. Do it with Canoe.”", src: "/projects/canoe/home.webp" },
  href: "https://canoe.quest",
  label: "canoe.quest",
  samples: [
    {
      alt: "A typographic wedding invitation for Arka and Nadine, set around a kawung motif",
      caption: "Wedding invitation · concept",
      href: "https://canoe.quest/w/e/porto-001-arka-nadine/",
      shape: "tall",
      src: "/projects/canoe/invitation-arka-nadine.webp",
    },
    {
      alt: "An illustrated wedding invitation for Bima and Sekar: the road up to a garden in the hills",
      caption: "Wedding invitation · concept",
      href: "https://canoe.quest/w/d/porto-001-bima-sekar/",
      shape: "tall",
      src: "/projects/canoe/invitation-bima-sekar.webp",
    },
    {
      alt: "A company profile for Samara Studio, an interior architecture practice",
      caption: "Company profile · concept",
      href: "https://canoe.quest/cp/e/porto-001-samara-studio/",
      shape: "wide",
      src: "/projects/canoe/profile-samara-studio.webp",
    },
    {
      alt: "A campaign microsite for the Arkana night run: “Every light is green.”",
      caption: "Campaign microsite · concept",
      href: "https://canoe.quest/m/e/porto-001-arkana/",
      shape: "wide",
      src: "/projects/canoe/microsite-arkana.webp",
    },
  ],
};
