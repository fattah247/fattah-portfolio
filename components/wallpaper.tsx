/**
 * The desktop picture: two volcanoes behind terraced rice hills, drawn as pixel art. Every edge sits
 * on a 4-unit grid (one wallpaper pixel), every fill is one solid tone, and the light comes from the
 * upper left, as on the app icons. The terraces keep the old pattern's idea (the cases' state
 * transitions as landscape), now as rice terraces with their bunds drawn across the hill faces.
 * It is static: the wallpaper never moves, scrolls, or follows the pointer, and it is anchored to
 * the bottom so every aspect ratio crops sky, not land. The geometry is computed once, at load.
 */
const width = 1600;
const height = 1000;
const pixel = 4;
const snap = (value: number) => Math.round(value / pixel) * pixel;

/** The top edge of a shape, sampled once per pixel column from x0 to x1. Steps are written as
 * relative moves, which keeps the markup short: each wallpaper renders inline on every page. */
function ridge(top: (x: number) => number, x0 = 0, x1 = width) {
  let d = "";
  let previous = Number.NaN;
  let stepX = x0;
  for (let x = x0; x < x1; x += pixel) {
    const y = snap(top(x + pixel / 2));
    if (x === x0) d = `M${x0} ${y}`;
    else if (y !== previous) {
      d += `h${x - stepX}v${y - previous}`;
      stepX = x;
    }
    previous = y;
  }
  return { d: `${d}H${x1}`, end: previous };
}

/** A solid shape: an edge closed down to the bottom of the picture. */
const land = (edge: string, x0 = 0) => `${edge}V${height}H${x0}Z`;

type Run = [x: number, y: number, length: number, rows?: number];

/** Horizontal runs of whole pixels, `rows` pixels tall (one by default), as one path. Each run
 * starts relative to the one before, since a closed subpath returns to its own start. */
function runs(items: Run[]) {
  let d = "";
  let [lastX, lastY] = [0, 0];
  for (const [x, y, length, rows = 1] of items) {
    d += `${d ? `m${x - lastX} ${y - lastY}` : `M${x} ${y}`}h${length}v${rows * pixel}h${-length}z`;
    [lastX, lastY] = [x, y];
  }
  return d;
}

type Volcano = { x: number; y: number; foot: number; left: number; right: number; rim: [number, number, number] };

/** A stratovolcano: concave flanks that steepen toward an uneven crater rim. `rim` is the left
 * rim's half-width, the right rim's half-width, and how far the right rim sits below the left. */
function volcanoTop({ x: centre, y: summit, foot, left, right, rim: [rimLeft, rimRight, rimDrop] }: Volcano) {
  return (x: number) => {
    if (x >= centre - rimLeft && x <= centre + rimRight) {
      if (x < centre - rimLeft + 12) return summit;
      if (x > centre + rimRight - 12) return summit + rimDrop;
      return summit + rimDrop + 8;
    }
    const distance = x < centre ? centre - rimLeft - x : x - centre - rimRight;
    const base = x < centre ? summit : summit + rimDrop;
    return foot - (foot - base) * Math.exp(-distance / (x < centre ? left : right));
  };
}

/** The sunlit left face: the volcano's edge up to the crater, then down a wandering ridge line. */
function litFace(top: (x: number) => number, volcano: Volcano, lean: number, wander: number) {
  const edge = ridge(top, 0, volcano.x);
  let descent = "";
  let x = volcano.x;
  for (let y = edge.end; y < height; y += pixel) {
    const fall = y - volcano.y;
    const next = snap(volcano.x + fall * lean + wander * Math.sin(fall / 41));
    descent += `${next === x ? "" : `h${next - x}`}v${pixel}`;
    x = next;
  }
  return `${edge.d}${descent}H0Z`;
}

/* Far ridge: the lightest land, a long low line under both volcanoes. */
const range = ridge((x) => 640 - 20 * Math.sin(x / 230 + 0.6) - 12 * Math.sin(x / 101 + 1.9) - 6 * Math.sin(x / 47));

/* The far volcano stands left and lower; the near one is larger, with a shoulder on its right. */
const farVolcano: Volcano = { x: 390, y: 480, foot: 760, left: 250, right: 230, rim: [24, 28, 4] };
const nearVolcano: Volcano = { x: 830, y: 376, foot: 800, left: 280, right: 250, rim: [36, 40, 8] };
const farTop = volcanoTop(farVolcano);
const nearCone = volcanoTop(nearVolcano);
const nearTop = (x: number) => nearCone(x) - (x > nearVolcano.x ? 30 * Math.exp(-(((x - 1104) / 64) ** 2)) : 0);

/* Clouds: cumulus built from overlapping half-disc puffs on one flat base, row by pixel row; the
 * two rows above the base are in shade. */
function cumulus(base: number, puffs: Array<[centre: number, radius: number]>): [light: Run[], shade: Run[]] {
  const light: Run[] = [];
  const shade: Run[] = [];
  const tallest = Math.max(...puffs.map(([, radius]) => radius));
  for (let y = base - snap(tallest); y < base; y += pixel) {
    const spans = puffs
      .filter(([, radius]) => base - y <= radius)
      .map(([centre, radius]) => {
        const half = Math.sqrt(radius ** 2 - (base - y - pixel / 2) ** 2);
        return [snap(centre - half), snap(centre + half)] as const;
      })
      .sort(([a], [b]) => a - b);
    let [start, end] = spans[0];
    for (const [left, right] of [...spans.slice(1), [Number.POSITIVE_INFINITY, 0] as const]) {
      if (left <= end) { end = Math.max(end, right); continue; }
      (base - y <= pixel * 2 ? shade : light).push([start, y, end - start]);
      [start, end] = [left, right];
    }
  }
  return [light, shade];
}
const clouds = [
  cumulus(620, [[504, 28], [556, 48], [620, 38], [672, 22]]),
  cumulus(216, [[1150, 26], [1200, 44], [1258, 34], [1300, 20]]),
  cumulus(280, [[640, 22], [686, 38], [742, 52], [806, 34], [846, 18]]),
];

/* Terraced hills: a bell-shaped hill, a little longer on one side, with its terraces drawn as
 * bunds. Each bund follows one level across the face and dips toward the viewer in the middle, as
 * the front edge of a level ring seen from slightly above. */
function terracedHill(centre: number, crown: number, spread: [left: number, right: number], rise: number) {
  const lift = height - crown;
  const outline = ridge((x) => height - lift * Math.exp(-(((x - centre) / spread[x < centre ? 0 : 1]) ** 2)));
  const bunds: Run[] = [];
  for (let top = height - rise; top > crown + rise / 2; top -= rise) {
    const reach = Math.sqrt(Math.log(lift / (height - top)));
    const left = snap(centre - spread[0] * reach);
    const right = snap(centre + spread[1] * reach);
    const half = (right - left) / 2;
    const middle = (left + right) / 2;
    const bund = (x: number) => snap(top + half * 0.05 * (1 - ((x + pixel / 2 - middle) / half) ** 2));
    for (let x = left; x < right;) {
      const y = bund(x);
      let end = x + pixel;
      while (end < right && bund(end) === y) end += pixel;
      bunds.push([x, y, end - x]);
      x = end;
    }
  }
  return { body: land(outline.d), bunds: runs(bunds) };
}
const backHill = terracedHill(1210, 720, [380, 420], 24);
const frontHill = terracedHill(430, 692, [440, 360], 24);

/* Foreground: a low bank along the bottom edge that joins the two hills, its top pixel lit. */
const bankTop = (x: number) => 940 - 10 * Math.sin(x / 140 + 0.8) - 6 * Math.sin(x / 61);
const bankEdge = ridge(bankTop);
const bank = ridge((x) => bankTop(x) + pixel);

export function Wallpaper() {
  return (
    <div aria-hidden="true" className="environment-wallpaper">
      <svg className="wallpaper-art" focusable="false" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" viewBox={`0 0 ${width} ${height}`}>
        <rect className="wallpaper-sky" height={height} width={width} />
        <path className="wallpaper-cloud" d={runs(clouds.slice(1).flatMap(([light]) => light))} />
        <path className="wallpaper-cloud-shade" d={runs(clouds.slice(1).flatMap(([, shade]) => shade))} />
        <path className="wallpaper-range" d={land(range.d)} />
        <path className="wallpaper-far-volcano" d={land(ridge(farTop).d)} />
        <path className="wallpaper-far-volcano-lit" d={litFace(farTop, farVolcano, 0.12, 6)} />
        <path className="wallpaper-volcano" d={land(ridge(nearTop).d)} />
        <path className="wallpaper-volcano-lit" d={litFace(nearTop, nearVolcano, 0.14, 10)} />
        <path className="wallpaper-cloud" d={runs(clouds[0][0])} />
        <path className="wallpaper-cloud-shade" d={runs(clouds[0][1])} />
        <path className="terrace terrace-back" d={backHill.body} />
        <path className="terrace-bund terrace-bund-back" d={backHill.bunds} />
        <path className="terrace terrace-front" d={frontHill.body} />
        <path className="terrace-bund terrace-bund-front" d={frontHill.bunds} />
        <path className="wallpaper-bank-edge" d={land(bankEdge.d)} />
        <path className="wallpaper-bank" d={land(bank.d)} />
      </svg>
    </div>
  );
}
