import { describe, it, expect } from "vitest";
import { wouldCreateCycle, classifyDrop } from "../cycleCheck";

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

describe("classifyDrop", () => {
  // M → A → B, M → C
  const tree = [
    { parent_account_id: "M", child_account_id: "A" },
    { parent_account_id: "A", child_account_id: "B" },
    { parent_account_id: "M", child_account_id: "C" },
  ];
  const node = (accountId: string, parentId: string | null, linkId: string | null = "link"): {
    accountId: string; parentId: string | null; linkId: string | null;
  } => ({ accountId, parentId, linkId });

  it("returns null when hovering over itself", () => {
    expect(classifyDrop(tree, node("A", "M"), "A", "M")).toBeNull();
  });

  it("returns 'reorder' for same-parent siblings", () => {
    // A and C are both children of M.
    expect(classifyDrop(tree, node("A", "M"), "C", "M")).toBe("reorder");
  });

  it("returns 'valid' for a legit reparent", () => {
    // Move C under B (B is not a descendant of C).
    expect(classifyDrop(tree, node("C", "M"), "B", "A")).toBe("valid");
  });

  it("returns 'invalid' when it would create a cycle", () => {
    // Move A under B (B is A's descendant).
    expect(classifyDrop(tree, node("A", "M"), "B", "A")).toBe("invalid");
  });

  it("returns 'invalid' when target is already the parent", () => {
    expect(classifyDrop(tree, node("B", "A"), "A", "M")).toBe("invalid");
  });

  it("returns 'invalid' for an orphan with no parent link", () => {
    expect(classifyDrop(tree, node("X", null, null), "M", null)).toBe("invalid");
  });

  it("returns null when there is no active drag", () => {
    expect(classifyDrop(tree, null, "A", "M")).toBeNull();
  });
});
