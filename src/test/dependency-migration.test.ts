import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as XLSX from "xlsx";
import { templateDraft } from "@/lib/messaging";
import { customerCreateSchema } from "@/lib/customer-create-schema";

describe("secure dependency migration behavior", () => {
  it("retains spreadsheet export and import values", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Name", "Amount"], ["Test customer", 1250]]), "Customers");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
    const restored = XLSX.read(bytes, { type: "array" });
    const sheet = restored.Sheets["Customers"];
    if (!sheet) throw new Error("Missing restored sheet");
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })).toEqual([["Name", "Amount"], ["Test customer", 1250]]);
  });

  it("preserves WhatsApp sample values and rejects non-string samples", () => {
    const draft = { company_id: null, name: "test_template", category: "UTILITY", language: "en", header_type: "none", header: "", body: "Hello {{1}}", footer: "", buttons: [], samples: { "1": "Customer" } };
    expect(templateDraft.parse(draft).samples).toEqual({ "1": "Customer" });
    expect(templateDraft.safeParse({ ...draft, samples: { "1": 123 } }).success).toBe(false);
  });

  it("rejects customer input with an injected actor", () => {
    expect(customerCreateSchema.safeParse({ company_name: "Test", full_name: "Test", email: "test@example.invalid", phone: "", password: "test-only-password", _actor: "unauthorized" }).success).toBe(false);
  });

  it("rejects oversized arrays before validating their elements", () => {
    let visited = 0;
    const schema = z.array(z.string().superRefine(() => { visited += 1; })).max(2);
    expect(schema.safeParse(["one", "two", "three"]).success).toBe(false);
    expect(visited).toBe(0);
  });
});