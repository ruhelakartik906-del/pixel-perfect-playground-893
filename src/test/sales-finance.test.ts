import { describe, it, expect } from "vitest";
import { allowableCredit, allowablePayment, invoiceBalance, invoiceTotals, realizedRevenue, revenueReceiptTotal } from "@/lib/sales-finance";
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
  it("requires payment authorization and rejects overpayment after credits", () => {
    expect(allowablePayment(1050, 400, 100, 550, true)).toBe(true);
    expect(allowablePayment(1050, 400, 100, 550.01, true)).toBe(false);
    expect(allowablePayment(1050, 400, 100, 100, false)).toBe(false);
  });
  it("caps credits and included tax at remaining invoice allowances", () => {
    expect(allowableCredit(1050, 100, 50, 5, 950, 45)).toBe(true);
    expect(allowableCredit(1050, 100, 50, 5, 950.01, 45)).toBe(false);
    expect(allowableCredit(1050, 100, 50, 5, 100, 45.01)).toBe(false);
  });
  it("never counts a manual invoice-linked entry again alongside a payment", () => {
    expect(revenueReceiptTotal([{ amount: 400 }], [{ amount: 400, invoice_id: "invoice-1", status: "posted" }, { amount: 50, invoice_id: null, status: "posted" }, { amount: 200, invoice_id: null, status: "void" }])).toBe(450);
  });
});