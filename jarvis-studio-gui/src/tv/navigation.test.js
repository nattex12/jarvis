import { describe, expect, it } from "vitest";
import { nextInDirection } from "./navigation";

const rect = (left, top, width = 80, height = 40) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});
const origin = rect(100, 100);
describe("TV spatial navigation", () => {
  it("chooses the same row before a closer diagonal and ignores controls behind", () => {
    const right = { rect: rect(300, 100) };
    expect(
      nextInDirection(
        origin,
        [{ rect: rect(50, 100) }, { rect: rect(200, 0) }, right],
        "ArrowRight",
      ),
    ).toBe(right);
  });
  it("moves vertically and does not wrap at an edge", () => {
    const above = { rect: rect(100, 20) };
    const below = { rect: rect(100, 200) };
    expect(nextInDirection(origin, [above, below], "ArrowUp")).toBe(above);
    expect(nextInDirection(origin, [above, below], "ArrowDown")).toBe(below);
    expect(nextInDirection(origin, [above, below], "ArrowLeft")).toBeUndefined();
  });
  it("finds offscreen controls so they can be scrolled into view", () => {
    const far = { rect: rect(100, 1800) };
    expect(nextInDirection(origin, [far], "ArrowDown")).toBe(far);
  });
});
