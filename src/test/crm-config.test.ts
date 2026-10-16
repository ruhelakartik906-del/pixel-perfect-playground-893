import { describe, expect, it } from "vitest";
import { canDelete, moveItem } from "@/lib/crm-config";

describe("crm config", () => {
  const items = [{ id: "a", position: 0 }, { id: "b", position: 1 }, { id: "c", position: 2 }];
  it("moves a stage down and renumbers positions", () => {
    expect(moveItem(items, 0, 1).map((i) => `${i.id}${i.position}`)).toEqual(["b0", "a1", "c2"]);
  });
  it("ignores moves past the edge", () => {
    expect(moveItem(items, 2, 1)).toBe(items);
  });
  it("blocks deleting items in use or the default pipeline", () => {
    expect(canDelete(3)).toBe(false);
    expect(canDelete(0, true)).toBe(false);
    expect(canDelete(0)).toBe(true);
  });
});
