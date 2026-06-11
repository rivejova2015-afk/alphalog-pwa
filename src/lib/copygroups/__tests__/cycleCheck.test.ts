import { describe, it, expect } from "vitest";
import { wouldCreateCycle } from "../cycleCheck";

// Tree: M → A → B, and M → C
const links = [
  { parent_account_id: "M", child_account_id: "A" },
  { parent_account_id: "A", child_account_id: "B" },
  { parent_account_id: "M", child_account_id: "C" },
];

describe("wouldCreateCycle", () => {
  it("is true when the new parent is the dragged node itself", () => {
    expect(wouldCreateCycle(links, "A", "A")).toBe(true);
  });

  it("is true when the new parent is a descendant of the dragged node", () => {
    // Moving A under B would make A a child of its own descendant → cycle.
    expect(wouldCreateCycle(links, "A", "B")).toBe(true);
  });

  it("is false for a valid reparent (sibling subtree)", () => {
    // Moving B under C is fine — C is not a descendant of B.
    expect(wouldCreateCycle(links, "B", "C")).toBe(false);
  });

  it("is false when moving a node up to the root", () => {
    expect(wouldCreateCycle(links, "B", "M")).toBe(false);
  });

  it("handles deep chains without infinite loops", () => {
    const chain = [
      { parent_account_id: "M", child_account_id: "A" },
      { parent_account_id: "A", child_account_id: "B" },
      { parent_account_id: "B", child_account_id: "C" },
      { parent_account_id: "C", child_account_id: "D" },
    ];
    expect(wouldCreateCycle(chain, "A", "D")).toBe(true); // D is under A
    expect(wouldCreateCycle(chain, "D", "A")).toBe(false); // A is above D
  });
});
