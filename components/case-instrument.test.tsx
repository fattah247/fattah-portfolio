import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChangeMarks } from "./case-instrument";

describe("instrument change marks", () => {
  it("marks only the values that changed in the latest update, flipping parity each update", () => {
    const { rerender, result } = renderHook(({ values }) => useChangeMarks(values), { initialProps: { values: { a: "1", b: "x" } } });
    // The first render shows the story's state: nothing has changed yet.
    expect(result.current).toEqual({});

    rerender({ values: { a: "2", b: "x" } });
    expect(result.current).toEqual({ a: "odd" });

    // A re-render with the same values keeps the last marks; nothing new animates.
    rerender({ values: { a: "2", b: "x" } });
    expect(result.current).toEqual({ a: "odd" });

    rerender({ values: { a: "3", b: "y" } });
    expect(result.current).toEqual({ a: "even", b: "even" });

    rerender({ values: { a: "3", b: "z" } });
    expect(result.current).toEqual({ b: "odd" });
  });
});
