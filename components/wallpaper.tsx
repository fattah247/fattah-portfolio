/**
 * The desktop pattern: a solid sky over three stepped terraces with hard two-pixel edges and a
 * few block clouds. The steps are the cases' state transitions drawn as landscape. It is static:
 * the wallpaper never moves, scrolls, or follows the pointer, and it is anchored to the bottom so
 * every aspect ratio crops the sky, not the steps.
 */
const steps = (start: number, rise: number, run: number, count: number) => {
  let d = `M0 ${start}`;
  let y = start;
  for (let index = 0; index < count; index += 1) {
    d += `H${(index + 1) * run}V${y - rise}`;
    y -= rise;
  }
  return `${d}H1600`;
};

const far = steps(846, 34, 240, 7);
const mid = steps(900, 32, 280, 5);
const near = steps(952, 30, 340, 4);

export function Wallpaper() {
  return (
    <div aria-hidden="true" className="environment-wallpaper">
      <svg className="wallpaper-art" focusable="false" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" viewBox="0 0 1600 1000">
        <rect className="wallpaper-sky" height="1000" width="1600" />
        <g className="wallpaper-clouds">
          <path d="M1064 168h136v24h-136zM1096 144h72v24h-72zM1240 224h96v16h-96zM1256 208h48v16h-48zM320 128h88v16h-88zM344 112h40v16h-40z" />
        </g>
        <path className="terrace terrace-far" d={`${far}V1000H0Z`} />
        <path className="terrace-edge" d={far} />
        <path className="terrace terrace-mid" d={`${mid}V1000H0Z`} />
        <path className="terrace-edge" d={mid} />
        <path className="terrace terrace-near" d={`${near}V1000H0Z`} />
        <path className="terrace-edge" d={near} />
      </svg>
    </div>
  );
}
