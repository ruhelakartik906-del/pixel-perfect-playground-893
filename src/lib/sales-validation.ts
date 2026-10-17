export type ProductInput = { name: string; selling_price: string | number; cost_price: string | number | null; tax_rate: string | number; stock_quantity: string | number };
export function validateProduct(input: ProductInput): string | null {
  if (!input.name.trim()) return "Name is required";
  for (const [label, value] of [["Selling price", input.selling_price], ["Stock quantity", input.stock_quantity]] as const) {
    if (String(value).trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return `${label} must be zero or greater`;
  }
  if (input.cost_price !== null && input.cost_price !== "" && (!Number.isFinite(Number(input.cost_price)) || Number(input.cost_price) < 0)) return "Cost price must be zero or greater";
  const rate = Number(input.tax_rate);
  if (String(input.tax_rate).trim() === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) return "Tax rate must be between 0 and 100";
  return null;
}
export function validateCustomer(input: { name: string; email: string }): string | null {
  if (!input.name.trim()) return "Customer name is required";
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "Enter a valid email";
  return null;
}
export function existingCustomerForLead<T extends { lead_id: string | null }>(customers: T[], leadId: string): T | undefined {
  return leadId ? customers.find((customer) => customer.lead_id === leadId) : undefined;
}