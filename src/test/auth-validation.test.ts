import { describe, expect, it } from "vitest";
import { registerSchema } from "@/lib/auth-validation";
import { workspacePathForStatus } from "@/lib/account-status";

describe("account access rules", () => {
  it("routes pending, active and blocked accounts to the correct screens", () => {
    expect(workspacePathForStatus("pending")).toBe("/pending-approval");
    expect(workspacePathForStatus("active")).toBe("/dashboard");
    expect(workspacePathForStatus("blocked")).toBe("/restricted");
  });

  it("requires registration terms and matching passwords", () => {
    const result = registerSchema.safeParse({
      fullName: "Routiva User",
      companyName: "Routiva",
      email: "user@example.com",
      phone: "+46701234567",
      password: "password123",
      confirmPassword: "different123",
      terms: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain("confirmPassword");
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain("terms");
    }
  });
});
