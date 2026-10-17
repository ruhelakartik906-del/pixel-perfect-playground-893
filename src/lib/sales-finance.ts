import Decimal from "decimal.js";
export type InvoiceLine = { product_id: string; name: string; quantity: string | number; unit_price: string | number; discount_percent: string | number; tax_rate: string | number; cost_price: number | null };
export type TaxMode = "none" | "cgst_sgst" | "igst";
export function invoiceTotals(items: InvoiceLine[], mode: TaxMode) {
  let subtotal = new Decimal(0), discount = new Decimal(0), tax = new Decimal(0), cgst = new Decimal(0), sgst = new Decimal(0), igst = new Decimal(0);
  for (const item of items) {
    const raw = new Decimal(item.quantity || 0).mul(item.unit_price || 0).toDecimalPlaces(2);
    const base = raw.mul(new Decimal(1).minus(new Decimal(item.discount_percent || 0).div(100))).toDecimalPlaces(2);
    const amount = mode === "none" ? new Decimal(0) : base.mul(item.tax_rate || 0).div(100).toDecimalPlaces(2);
    subtotal = subtotal.plus(raw); discount = discount.plus(raw.minus(base)); tax = tax.plus(amount);
    if (mode === "cgst_sgst") { const half = amount.div(2).toDecimalPlaces(2); cgst = cgst.plus(half); sgst = sgst.plus(amount.minus(half)); }
    if (mode === "igst") igst = igst.plus(amount);
  }
  return { subtotal: subtotal.toNumber(), discount: discount.toNumber(), tax: tax.toNumber(), total: subtotal.minus(discount).plus(tax).toNumber(), cgst: cgst.toNumber(), sgst: sgst.toNumber(), igst: igst.toNumber() };
}
export function invoiceBalance(total: number, paid: number, credited: number) {
  const balance = new Decimal(total).minus(credited).minus(paid);
  return { outstanding: Decimal.max(0, balance).toNumber(), customerCredit: Decimal.max(0, balance.negated()).toNumber(), adjusted: new Decimal(total).minus(credited).toNumber() };
}
export function realizedRevenue(total: number, tax: number, paid: number, credits: number, creditTax: number) {
  const adjusted = new Decimal(total).minus(credits);
  if (adjusted.lte(0)) return 0;
  return Decimal.max(0, adjusted.minus(new Decimal(tax).minus(creditTax))).mul(Decimal.min(paid, adjusted)).div(adjusted).toDecimalPlaces(2).toNumber();
}