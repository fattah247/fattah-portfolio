import type { PortfolioAppId } from "./workspace-manager";

/**
 * The four application icons are one authored pixel family, drawn as pixel maps rather than
 * vector shapes so every edge lands on the grid:
 * - Objects, not tiles: an open project folder with a sea-green tab and a state diagram on its
 *   front sheet, a clipboard carrying a CV, an envelope with a perforated stamp (its picture is
 *   the wallpaper's terraces), and a card file with tabbed index cards. No background square.
 * - Every object has a one-pixel ink outline and flat fills, lit from the top left: one light
 *   row and column, one shade row and column. No gradients, no gloss, no anti-aliased lines.
 * - The large drawing is 32 x 32 (shown at 32, 48, 64, 96 px). Below 32 px the icon switches
 *   to a separate 16 x 16 drawing with fewer parts, so a taskbar icon is redrawn, not shrunk.
 * The same identity is used by the desktop, taskbar, tablet shelf, phone launcher, and Recents.
 *
 * Map key: . clear, k ink, w white, p paper, g/G paper shades, s/S slate and graphite,
 * b/B/D steel blue light, face, deep, A accent, t/T/Y sea green pale, face, deep.
 */
export const appIconPalette: Record<string, string> = {
  k: "#252b34", w: "#ffffff", p: "#f7f8f9", g: "#d3d9e1", G: "#b8c1cd",
  s: "#8d98a7", S: "#59616d",
  b: "#c8d8f0", B: "#8ea5cb", D: "#6e88b6", A: "#536fa3",
  t: "#cfe3df", T: "#5e9990", Y: "#3a7a6c",
};

type PixelMap = readonly string[];

export const appIconDrawings: Record<PortfolioAppId, { large: PixelMap; small: PixelMap }> = {
  work: {
    large: [
      "................................",
      "................................",
      "................................",
      "...............kkkkkkkkkkkk.....",
      "..kkkkkkkkkkk..kggggggggggk.....",
      "..ktttkkkkkkkkkkkkkkkkkkkgk.....",
      "..kTTTkwwwwwwwwwwwwwwwwwkgk.....",
      "..kTTTkpppppppppppkkkkkpkgkkkk..",
      "..kTTTkppkkkkkppppktttkpkgkBBk..",
      "..kDDDkppkpppkpppAkTTTkpkgkDDk..",
      "..kDDDkppkpSpkAAAAkTTTkpkgkDDk..",
      "..kDDDkppkpppkpppAkTTTkpkgkDDk..",
      "..kDDDkppkkkkkppppkkkkkpkgkDDk..",
      "..kDDDkpppppppppppppppppkgkDDk..",
      "..kDDDkpppppppppppppppppkkkDDk..",
      ".kkkkkkkkkkkkppppppkkkkkkkkkkkk.",
      ".kbbbbbbbbbbkppppppkbbbbbbbbbbk.",
      ".kbBBBBBBBBBBkkkkkkBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kbBBBBBBBBBBBBBBBBBBBBBBBBBBDk.",
      ".kDDDDDDDDDDDDDDDDDDDDDDDDDDDDk.",
      ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    small: [
      "................",
      ".kkkkkk.........",
      ".kttkkkkkkkkk...",
      ".kkkkpppkkkpkkk.",
      ".kBBkpppkTkpkBk.",
      ".kDDkpppkkkpkDk.",
      ".kDDkpppppppkDk.",
      "kkkkkkppppkkkkkk",
      "kbbbbbkkkkbbbbbk",
      "kBBBBBBBBBBBBBBk",
      "kBBBBBBBBBBBBBBk",
      "kBBBBBBBBBBBBBBk",
      "kBBBBBBBBBBBBBBk",
      "kDDDDDDDDDDDDDDk",
      "kkkkkkkkkkkkkkkk",
      "................",
    ],
  },
  experience: {
    large: [
      "................................",
      "................................",
      ".............kkkkkk.............",
      ".............kGkkGk.............",
      ".....kkkkkkkkkGGGGkkkkkkkkk.....",
      ".....ksssskkkkkkkkkkkkssssk.....",
      ".....ksSSSkwwwwwwwwwwkSSSSk.....",
      ".....ksSSSkGGGGGGGGGGkSSSSk.....",
      ".....kskkkksssssssssskkkkSk.....",
      ".....kskwwkkkkkkkkkkkkwwkSk.....",
      ".....kskppppppppppppppppkSk.....",
      ".....kskppppppppppppppppkSk.....",
      ".....kskpkkkkkkkppppppppkSk.....",
      ".....kskpktTTTtkpYYYYYYpkSk.....",
      ".....kskpktTTTtkppppppppkSk.....",
      ".....kskpktTTTtkpGGGGGppkSk.....",
      ".....kskpktttttkppppppppkSk.....",
      ".....kskpkTTTTTkpGGGGGGpkSk.....",
      ".....kskpkTTTTTkppppppppkSk.....",
      ".....kskpkkkkkkkppppppppkSk.....",
      ".....kskppppppppppppppppkSk.....",
      ".....kskppppppppppppppppkSk.....",
      ".....kskpTTTTTTTTpppppppkSk.....",
      ".....kskppppppppppppppppkSk.....",
      ".....kskpGGGGGGGGGGGGGGpkSk.....",
      ".....kskppppppppppppppppkSk.....",
      ".....kskpGGGGGGGGGGGppppkSk.....",
      ".....kskkkkkkkkkkkkkkkkkkSk.....",
      ".....ksSSSSSSSSSSSSSSSSSSSk.....",
      ".....kkkkkkkkkkkkkkkkkkkkkk.....",
      "................................",
      "................................",
    ],
    small: [
      "................",
      ".....kkkkkk.....",
      "..kkkkGkkGkkkk..",
      "..kSSkGGGGkSSk..",
      "..kkkkkkkkkkkk..",
      "..kkppppppppkk..",
      "..kkTTTpYYYYkk..",
      "..kkTTTpppppkk..",
      "..kkTTTpGGGpkk..",
      "..kkTTTpppppkk..",
      "..kkppppppppkk..",
      "..kkGGGGGGGpkk..",
      "..kkppppppppkk..",
      "..kkGGGGGGppkk..",
      "..kkkkkkkkkkkk..",
      "..kkkkkkkkkkkk..",
    ],
  },
  contact: {
    large: [
      "................................",
      "................................",
      "...................wkwkwkwkwk...",
      "...................wwwwwwwwww...",
      "...................kwbbbbbbwk...",
      "...................wwbbbwbbww...",
      "...................kwbbbbbbwk...",
      "...................wwTTbbbbww...",
      "..kkkkkkkkkkkkkkkkkkwTTTTAAwkk..",
      "..kkkbbbbbbbbbbbbbbwwTTTAAAwwk..",
      "..kppkkbbbbbbbbbbbbkwTTTAAAwkk..",
      "..kppppkkbbbbbbbbbbwwwwwwwwwwk..",
      "..kppppppkkbbbbbbbbwkwkwkwkwkk..",
      "..kppppppppkkbbbbbbkkppppppppk..",
      "..kppppppppppkkbbkkppppppppppk..",
      "..kppppppppppppkkppppppppppppk..",
      "..kppppppppppppppppppppppppppk..",
      "..kppppppppppppppppppppppppppk..",
      "..kppppppppppppppppppppppppppk..",
      "..kppppppppppppppppppppppppppk..",
      "..kppppppppppppppppppppppppppk..",
      "..kppppppppppppppppppppppppppk..",
      "..kppppppppGGppppppGGppppppppk..",
      "..kppppppGGppppppppppGGppppppk..",
      "..kppppGGppppppppppppppGGppppk..",
      "..kppGGppppppppppppppppppGGppk..",
      "..kggggggggggggggggggggggggggk..",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    small: [
      "................",
      "..........kkkkkk",
      "..........kbbbbk",
      "..........kbbbbk",
      "..........kTTTTk",
      "kkkkkkkkkkkTTTTk",
      "kkkbbbbbbbkkkkkk",
      "kppkkbbbbbbkkppk",
      "kppppkkbbkkppppk",
      "kppppppkkppppppk",
      "kppppppppppppppk",
      "kppppppppppppppk",
      "kppppppppppppppk",
      "kppppppppppppppk",
      "kkkkkkkkkkkkkkkk",
      "................",
    ],
  },
  products: {
    large: [
      "................................",
      "................................",
      "................................",
      "................................",
      "...................kkkkkk.......",
      ".......kkkkkk......kAAAAk.......",
      ".......kTTTTk......kAAAAk.......",
      "......kkTTTTkkkkkkkkkkkkkk......",
      "......kkTTTTkkkkkkpppppppk......",
      ".....kkkkkkkkkGGGkkkkkkkkkk.....",
      ".....kpppppppkGGGkppppppppk.....",
      "....kkkkkkkkkkkkkkkkkkkkkkkk....",
      "....kwwwwwwwwwwwwwwwwwwwwwwk....",
      "....kppppppppppppppppppppppk....",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..",
      "..kggggggggggggggggggggggggggk..",
      "..kgssssssssssssssssssssssssSk..",
      "..kgssssssskkkkkkkkkksssssssSk..",
      "..kgssssssskppppppppksssssssSk..",
      "..kgssssssskpSSSSSSpksssssssSk..",
      "..kgssssssskppppppppksssssssSk..",
      "..kgssssssskkkkkkkkkksssssssSk..",
      "..kgssssssssssssssssssssssssSk..",
      "..kgsssssssskSSSSSSkssssssssSk..",
      "..kgssssssssskkkkkksssssssssSk..",
      "..kgssssssssssssssssssssssssSk..",
      "..kgssssssssssssssssssssssssSk..",
      "..kSSSSSSSSSSSSSSSSSSSSSSSSSSk..",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..",
      "................................",
      "................................",
      "................................",
    ],
    small: [
      "................",
      ".........kkkk...",
      "...kkk...kAAk...",
      "...kTkkkkkkkk...",
      "...kTkppppppk...",
      "..kkkkkkkkkkkk..",
      "..kppppppppppk..",
      ".kkkkkkkkkkkkkk.",
      ".kggggggggggggk.",
      ".kssskkkkkksssk.",
      ".kssskppppksssk.",
      ".kssskkkkkksssk.",
      ".kssssssssssssk.",
      ".kssssSSSSssssk.",
      ".kkkkkkkkkkkkkk.",
      "................",
    ],
  },
};

/** One path per colour: each horizontal run of a colour becomes a one-pixel-high rectangle. */
function compile(rows: PixelMap) {
  const runs = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const colour = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === colour) end += 1;
      if (colour !== ".") runs.set(colour, `${runs.get(colour) ?? ""}M${x} ${y}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return Array.from(runs, ([colour, d]) => ({ d, fill: appIconPalette[colour] }));
}

const compiled = Object.fromEntries(Object.entries(appIconDrawings).map(([app, { large, small }]) => [app, { large: compile(large), small: compile(small) }])) as Record<PortfolioAppId, { large: ReturnType<typeof compile>; small: ReturnType<typeof compile> }>;

export function AppIcon({ app, className = "", size, variant = "large" }: { app: PortfolioAppId; className?: string; size?: number; variant?: "large" | "small" }) {
  const grid = variant === "large" ? 32 : 16;
  return (
    <svg aria-hidden="true" className={`app-icon ${className}`.trim()} data-app={app} data-variant={variant} focusable="false" height={size} shapeRendering="crispEdges" viewBox={`0 0 ${grid} ${grid}`} width={size}>
      {compiled[app][variant].map(({ d, fill }) => <path d={d} fill={fill} key={fill} />)}
    </svg>
  );
}

/** The owner's monogram: initials on a small bevelled plate. */
export function OwnerMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`owner-mark ${className}`.trim()} focusable="false" shapeRendering="crispEdges" viewBox="0 0 32 32">
      <rect fill={appIconPalette.k} height="32" width="32" />
      <rect fill={appIconPalette.A} height="30" width="30" x="1" y="1" />
      <rect fill="#7590c4" height="1" width="29" x="1" y="1" />
      <rect fill="#7590c4" height="29" width="1" x="1" y="1" />
      <rect fill="#3f5687" height="1" width="29" x="2" y="30" />
      <rect fill="#3f5687" height="29" width="1" x="30" y="2" />
      <text fill="#f7f8f9" fontFamily="var(--font-body), sans-serif" fontSize="13" fontWeight="700" letterSpacing="-.3" textAnchor="middle" x="16" y="20.5">MF</text>
    </svg>
  );
}
