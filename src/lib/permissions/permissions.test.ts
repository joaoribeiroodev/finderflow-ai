import { describe, expect, it } from "vitest";

import { roleAtLeast } from "./permissions";

describe("roleAtLeast", () => {
  it("owner atende qualquer exigência", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("owner", "owner")).toBe(true);
  });

  it("viewer não atende exigência de member", () => {
    expect(roleAtLeast("viewer", "member")).toBe(false);
  });

  it("member atende exigência de member", () => {
    expect(roleAtLeast("member", "member")).toBe(true);
  });

  it("admin não atende exigência de owner", () => {
    expect(roleAtLeast("admin", "owner")).toBe(false);
  });
});
