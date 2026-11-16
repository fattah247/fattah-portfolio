import { renderCue, type CueId } from "./engine";

/*
 * Renders the portfolio's cues off the main thread, so drawing a sound never holds up the frame a
 * press is waiting for. Asked for takes in order, it sends each back as soon as it's done, its
 * samples handed over rather than copied.
 */
const worker = self as unknown as Worker;
worker.onmessage = (event: MessageEvent<Array<{ id: CueId; take: number }>>) => {
  for (const { id, take } of event.data) {
    const { L, R } = renderCue(id, take);
    worker.postMessage({ L, R, id, take }, [L.buffer, R.buffer]);
  }
};
