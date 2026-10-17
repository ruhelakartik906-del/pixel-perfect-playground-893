import { describe, it, expect } from "vitest";
import { invoiceBalance, invoiceTotals, realizedRevenue } from "@/lib/sales-finance";
describe("Sales accounting", () => {
  const line = { product_id: "p", name: "Service", quantity: "3", unit_price: "0.10", discount_percent: "10", tax_rate: "5", cost_price: null };
  it("calculates decimal quantity and discount without binary drift", () => {
    expect(invoiceTotals([line], "none")).toMatchObject({ subtotal: 0.3, discount: 0.03, total: 0.27 });
  });
  it("uses configurable GST and splits CGST/SGST with rounding conservation", () => {
    expect(invoiceTotals([{ ...line, quantity: "1", unit_price: "100", discount_percent: "10" }], "cgst_sgst")).toMatchObject({ subtotal: 100, discount: 10, tax: 4.5, cgst: 2.25, sgst: 2.25, total: 94.5 });
    expect(invoiceTotals([{ ...line, quantity: "1", unit_price: "100", discount_percent: "0", tax_rate: "12" }], "igst").igst).toBe(12);
  });
  it("reduces outstanding by both partial payments and credits", () => {
    expect(invoiceBalance(1050, 400, 100)).toEqual({ adjusted: 950, outstanding: 550, customerCredit: 0 });
    expect(invoiceBalance(1050, 1000, 100).customerCredit).toBe(50);
  });
  it("distinguishes tax-excluded realized revenue from cash received", () => {
    expect(realizedRevenue(1050, 50, 525, 0, 0)).toBe(500);
    expect(realizedRevenue(1050, 50, 475, 100, 5)).toBe(452.5);
  });
});