/*
 * The interface glyphs: pixel art on a 16-unit grid, like the app icons (app-icons.tsx). Every glyph
 * is a map of filled squares ("#"), compiled to one path of whole-unit runs and drawn with crisp
 * edges in the current text colour. They are shown at 16 px, or 32 px on the tablet shelf, so each
 * square lands on a screen pixel; nothing is stroked, curved or smoothed. Each glyph shows what its
 * control does: Start over goes back to the start, Reset puts things back as they were, Home is a
 * house, Recents is the board of open windows.
 */

type GlyphName = keyof typeof glyphMaps;
type IconProps = { className?: string };

export const glyphMaps = {
  "chevron-right": [
    "................",
    "................",
    "................",
    ".....##.........",
    "......##........",
    ".......##.......",
    "........##......",
    ".........##.....",
    ".........##.....",
    "........##......",
    ".......##.......",
    "......##........",
    ".....##.........",
    "................",
    "................",
    "................",
  ],
  "arrow-up-right": [
    "................",
    "................",
    "................",
    "......#######...",
    "......#######...",
    "..........###...",
    ".........####...",
    "........##.##...",
    ".......##..##...",
    "......##...##...",
    ".....##.........",
    "....##..........",
    "...##...........",
    "................",
    "................",
    "................",
  ],
  "download": [
    "................",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    "...##..##..##...",
    "....##.##.##....",
    ".....######.....",
    "......####......",
    ".......##.......",
    "................",
    "..##........##..",
    "..##........##..",
    "..############..",
    "..############..",
    "................",
  ],
  "play": [
    "................",
    "................",
    "................",
    ".....##.........",
    ".....####.......",
    ".....######.....",
    ".....########...",
    ".....#########..",
    ".....#########..",
    ".....########...",
    ".....######.....",
    ".....####.......",
    ".....##.........",
    "................",
    "................",
    "................",
  ],
  "pause": [
    "................",
    "................",
    "................",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "................",
    "................",
    "................",
  ],
  "start-over": [
    "................",
    "................",
    "................",
    "................",
    "..##....#...#...",
    "..##...##..##...",
    "..##..###.###...",
    "..##.########...",
    "..##.########...",
    "..##..###.###...",
    "..##...##..##...",
    "..##....#...#...",
    "................",
    "................",
    "................",
    "................",
  ],
  "reset": [
    "................",
    "......##........",
    ".....###........",
    "....#######.....",
    "....#########...",
    ".....###...###..",
    "......##....##..",
    "...##.......##..",
    "...##.......##..",
    "...##.......##..",
    "...###.....###..",
    "....#########...",
    "......#####.....",
    "................",
    "................",
    "................",
  ],
  "close": [
    "................",
    "................",
    "................",
    "...##......##...",
    "...###....###...",
    "....###..###....",
    ".....######.....",
    "......####......",
    "......####......",
    ".....######.....",
    "....###..###....",
    "...###....###...",
    "...##......##...",
    "................",
    "................",
    "................",
  ],
  "minimize": [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....########....",
    "....########....",
    "................",
    "................",
    "................",
  ],
  "maximize": [
    "................",
    "................",
    "................",
    "...##########...",
    "...##########...",
    "...#........#...",
    "...#........#...",
    "...#........#...",
    "...#........#...",
    "...#........#...",
    "...#........#...",
    "...##########...",
    "................",
    "................",
    "................",
    "................",
  ],
  "restore": [
    "................",
    "................",
    "................",
    ".....########...",
    ".....########...",
    ".....#......#...",
    "...########.#...",
    "...########.#...",
    "...#......###...",
    "...#......#.....",
    "...#......#.....",
    "...########.....",
    "................",
    "................",
    "................",
    "................",
  ],
  "more": [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "..##...##...##..",
    "..##...##...##..",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  "pair": [
    "................",
    "................",
    "................",
    ".######.######..",
    ".######.######..",
    ".#....#.#....#..",
    ".#....#.#....#..",
    ".#....#.#....#..",
    ".#....#.#....#..",
    ".#....#.#....#..",
    ".#....#.#....#..",
    ".######.######..",
    "................",
    "................",
    "................",
    "................",
  ],
  "home": [
    "................",
    ".......##.......",
    "......####......",
    ".....##..##.....",
    "....##....##....",
    "...##......##...",
    "..##........##..",
    ".###........###.",
    "...##......##...",
    "...##......##...",
    "...##..##..##...",
    "...##..##..##...",
    "...##..##..##...",
    "...##########...",
    "................",
    "................",
  ],
  "recents": [
    "................",
    "................",
    ".######..######.",
    ".######..######.",
    ".#....#..#....#.",
    ".#....#..#....#.",
    ".######..######.",
    "................",
    "................",
    ".######..######.",
    ".######..######.",
    ".#....#..#....#.",
    ".#....#..#....#.",
    ".######..######.",
    "................",
    "................",
  ],
  "shopee": [
    "................",
    "......####......",
    ".....##..##.....",
    ".....#....#.....",
    "..############..",
    "..############..",
    "..####....####..",
    "..###..#######..",
    "..####....####..",
    "..#######..###..",
    "..####....####..",
    "..############..",
    "...##########...",
    "...##########...",
    "................",
    "................",
  ],
  "amazon": [
    "................",
    "................",
    "....######......",
    ".........##.....",
    ".....######.....",
    "....##...##.....",
    "....##...##.....",
    ".....#######....",
    "................",
    "................",
    "..##........##..",
    "...##......###..",
    "....########.#..",
    "................",
    "................",
    "................",
  ],
  "tokopedia": [
    "................",
    "...##......##...",
    "...###....###...",
    "..############..",
    "..############..",
    "..##..####..##..",
    "..#....##....#..",
    "..#....##....#..",
    "..##..####..##..",
    "..#####..#####..",
    "..#####..#####..",
    "...##########...",
    "....########....",
    "................",
    "................",
    "................",
  ],
  "tiktok": [
    "................",
    ".......##.......",
    ".......###......",
    ".......####.....",
    ".......##.###...",
    ".......##..##...",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    "...######.......",
    "..#######.......",
    "..##...##.......",
    "..#######.......",
    "...#####........",
    "................",
    "................",
  ],
} satisfies Record<string, readonly string[]>;

const mirrored = (rows: readonly string[]) => rows.map((row) => [...row].reverse().join(""));
const transposed = (rows: readonly string[]) => rows.map((_, x) => rows.map((row) => row[x]).join(""));

/** The other three chevrons are the right one turned, so all four stay identical in weight. */
const chevronMaps = {
  right: glyphMaps["chevron-right"],
  left: mirrored(glyphMaps["chevron-right"]),
  down: transposed(glyphMaps["chevron-right"]),
  up: transposed(mirrored(glyphMaps["chevron-right"])),
} as const;

/** One path of horizontal runs, a unit tall each: every edge on the grid. */
export function glyphPath(rows: readonly string[]) {
  let d = "";
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return d;
}

function Glyph({ className, rows }: { className: string; rows: readonly string[] }) {
  return (
    <svg aria-hidden="true" className={`pixel-glyph ${className}`.trim()} focusable="false" shapeRendering="crispEdges" viewBox="0 0 16 16">
      <path d={glyphPath(rows)} fill="currentColor" stroke="none" />
    </svg>
  );
}

const glyph = (name: GlyphName, className = "inline-icon") => <Glyph className={className} rows={glyphMaps[name]} />;

/** Up and to the right: only for links that open a new tab. */
export function ArrowIcon({ className = "inline-icon" }: IconProps) {
  return glyph("arrow-up-right", className);
}

/** Run: a solid play triangle; while running it becomes two pause bars. */
export function PlayIcon({ paused = false, className = "inline-icon" }: IconProps & { paused?: boolean }) {
  return glyph(paused ? "pause" : "play", className);
}

/** Start over: back to the start (a bar, and two triangles running to it). */
export function StartOverIcon({ className = "inline-icon" }: IconProps) {
  return glyph("start-over", className);
}

/** Reset: put things back as they were (a loop running anticlockwise into its arrowhead). */
export function ResetIcon({ className = "inline-icon" }: IconProps) {
  return glyph("reset", className);
}

export function CloseIcon({ className = "system-control-icon" }: IconProps) {
  return glyph("close", className);
}

export function MinimizeIcon({ className = "system-control-icon" }: IconProps) {
  return glyph("minimize", className);
}

/** Maximize is one window; restored, it shows the window it returns to behind the one it is. */
export function MaximizeIcon({ restored = false, className = "system-control-icon" }: IconProps & { restored?: boolean }) {
  return glyph(restored ? "restore" : "maximize", className);
}

export function ChevronIcon({ className = "inline-icon", direction = "left" }: IconProps & { direction?: keyof typeof chevronMaps }) {
  return <Glyph className={className} rows={chevronMaps[direction]} />;
}

/** Window management menu: three square cells, matching the square geometry. */
export function MoreIcon({ className = "inline-icon" }: IconProps) {
  return glyph("more", className);
}

/** Two panes on one stage: the tablet pairing control. */
export function PairIcon({ className = "inline-icon" }: IconProps) {
  return glyph("pair", className);
}

/** Down into a tray: the file comes to the visitor. */
export function DownloadIcon({ className = "inline-icon" }: IconProps) {
  return glyph("download", className);
}

/** The system's Back, Home and Recents, shared by the taskbar, the tablet shelf and the phone bar. */
export function SystemIcon({ name, className = "system-glyph" }: IconProps & { name: "back" | "home" | "overview" }) {
  if (name === "back") return <Glyph className={className} rows={chevronMaps.left} />;
  return glyph(name === "home" ? "home" : "recents", className);
}

/** A marketplace's own mark, simplified to the grid. */
export function MarketplaceIcon({ marketplace, className = "marketplace-mark" }: IconProps & { marketplace: "shopee" | "amazon" | "tokopedia" | "tiktok" }) {
  return glyph(marketplace, className);
}
