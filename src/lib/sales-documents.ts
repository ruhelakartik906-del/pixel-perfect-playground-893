import { downloadBlob } from "@/lib/crm-data";
import { salesMoney } from "@/lib/sales-data";
type Doc = { title: string; number: string; seller: Record<string, unknown>; customer: Record<string, unknown>; date: string; due?: string; lines: (string | number)[][]; summary: [string, number][]; notes?: string; terms?: string };
export async function salesDocument(document: Doc, print = false) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const pdf = new jsPDF();
  pdf.setFontSize(20); pdf.text(String(document.seller['company_name'] || "Routiva CRM"), 14, 20);
  pdf.setFontSize(10); pdf.text(document.title, 14, 29); pdf.text(document.number, 14, 35);
  const sellerLines = [document.seller['address'], document.seller['gstin'] ? `GSTIN: ${document.seller['gstin']}` : "", document.seller['email'], document.seller['phone']].filter(Boolean).map(String);
  pdf.text(sellerLines, 14, 43);
  let y = Math.max(68, 45 + sellerLines.length * 5);
  pdf.setFontSize(11); pdf.text("Bill to", 14, y); pdf.setFontSize(10);
  const customerLines = [document.customer['name'], document.customer['company_name'], document.customer['address'], [document.customer['city'], document.customer['state'], document.customer['country']].filter(Boolean).join(", "), document.customer['gstin'] ? `GSTIN: ${document.customer['gstin']}` : ""].filter(Boolean).map(String);
  pdf.text(customerLines, 14, y + 6); pdf.text(`Issue date: ${document.date}${document.due ? `   Due: ${document.due}` : ""}`, 14, y + customerLines.length * 5 + 14);
  y += customerLines.length * 5 + 22;
  autoTable(pdf, { startY: y, head: [["Description", "Qty", "Unit Price", "Discount %", "Tax %", "Total"]], body: document.lines, styles: { fontSize: 9 } });
  const tableEnd = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = tableEnd + 12;
  for (const [label, amount] of document.summary) {
    if (y > 275) { pdf.addPage(); y = 20; }
    pdf.text(label, 115, y); pdf.text(salesMoney(amount).replace("₹", "INR "), 196, y, { align: "right" }); y += 7;
  }
  for (const text of [document.terms, document.notes].filter(Boolean)) {
    const wrapped = pdf.splitTextToSize(String(text), 175) as string[];
    if (y + wrapped.length * 5 > 275) { pdf.addPage(); y = 20; }
    y += 6; pdf.text(wrapped, 14, y); y += wrapped.length * 5;
  }
  if (print) {
    pdf.autoPrint();
    const url = URL.createObjectURL(pdf.output("blob"));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else downloadBlob(pdf.output("blob"), `${document.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`);
}