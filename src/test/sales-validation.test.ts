import { describe, expect, it } from "vitest";
import { existingCustomerForLead, validateProduct } from "@/lib/sales-validation";

describe("Sales safeguards", () => {
  it("keeps tax configurable rather than assuming 18 percent", () => {
    const item = { name: "Service", selling_price: "100", cost_price: "", stock_quantity: "0" };
    expect(validateProduct({ ...item, tax_rate: "0" })).toBeNull();
    expect(validateProduct({ ...item, tax_rate: "5" })).toBeNull();
    expect(validateProduct({ ...item, tax_rate: "101" })).not.toBeNull();
  });
  it("allows unavailable costs instead of inventing them", () => {
    expect(validateProduct({ name: "Service", selling_price: "100", cost_price: null, stock_quantity: "0", tax_rate: "0" })).toBeNull();
    expect(validateProduct({ name: "Service", selling_price: "100", cost_price: "-1", stock_quantity: "0", tax_rate: "0" })).not.toBeNull();
  });
  it("returns the existing sales customer when converting the same lead", () => {
    const customers = [{ id: "customer-1", lead_id: "lead-1" }, { id: "customer-2", lead_id: null }];
    expect(existingCustomerForLead(customers, "lead-1")?.id).toBe("customer-1");
    expect(existingCustomerForLead(customers, "lead-2")).toBeUndefined();
  });
});