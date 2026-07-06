// utils/payslipPdf.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export function buildPayslipPDF(res, { org, employee, payslip, breakdown, totals }) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  // Header / Brand
  doc
    .fontSize(18)
    .text(org.name || "Your Company Pvt. Ltd.", { align: "left" })
    .moveDown(0.1);
  doc
    .fontSize(10)
    .fillColor("#555")
    .text(org.address || "Address line 1, City, State - PIN")
    .text(org.phone || "Phone: +91-XXXXXXXXXX")
    .text(org.email || "support@company.com")
    .fillColor("#000");

  doc
    .moveDown(0.8)
    .fontSize(14)
    .text("PAYSLIP", { align: "center" })
    .moveDown(0.4);

  // Meta box
  const metaTop = doc.y;
  doc
    .fontSize(10)
    .text(`Employee Name: ${employee.name || "-"}`)
    .text(`Employee ID: ${employee.id || "-"}`)
    .text(`Department: ${employee.department || "-"}`)
    .text(`Designation: ${employee.designation || "-"}`)
    .text(`PAN: ${employee.pan || "-"}`)
    .text(`Bank (Last 4): ${employee.bank || "-"}`);

  doc.moveUp(6).text(`Month: ${payslip.month}`, 350)
     .text(`Payslip Date: ${dayjs(payslip.date || new Date()).format("DD MMM YYYY")}`, 350)
     .text(`Net Pay: ${money(payslip.amount)}`, 350);

  doc
    .moveDown(1.2)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .stroke();

  // Earnings & Deductions tables
  doc.moveDown(1);

  const leftX = 40;
  const rightX = 300;
  const rowHeight = 18;

  doc.fontSize(12).text("Earnings", leftX).text("Deductions", rightX);
  doc.moveDown(0.3);

  doc.fontSize(10).fillColor("#555");
  doc.text("Component", leftX, doc.y).text("Amount", leftX + 170, doc.y);
  doc.text("Component", rightX, doc.y).text("Amount", rightX + 170, doc.y);
  doc.fillColor("#000");

  const earnings = (breakdown || []).filter((b) => b.type === "positive");
  const deductions = (breakdown || []).filter((b) => b.type === "negative");

  const maxRows = Math.max(earnings.length, deductions.length);
  let y = doc.y + 6;

  for (let i = 0; i < maxRows; i++) {
    const e = earnings[i];
    const d = deductions[i];

    if (e) {
      doc.text(e.label || "-", leftX, y).text(money(e.amount), leftX + 170, y);
    }
    if (d) {
      doc.text(d.label || "-", rightX, y).text(money(Math.abs(d.amount)), rightX + 170, y);
    }
    y += rowHeight;
  }

  y += 6;
  doc
    .strokeColor("#e5e7eb")
    .moveTo(leftX, y)
    .lineTo(555, y)
    .stroke();

  y += 10;
  doc.fontSize(11).text("Total Earnings:", leftX, y).text(money(totals.earnings), leftX + 170, y);
  doc.text("Total Deductions:", rightX, y).text(money(totals.deductions), rightX + 170, y);

  y += 26;

  // Net pay band
  doc
    .roundedRect(40, y, 515, 40, 6)
    .fillOpacity(0.05)
    .fill("#16a34a")
    .fillOpacity(1)
    .strokeColor("#16a34a")
    .stroke();

  doc
    .fillColor("#14532d")
    .fontSize(12)
    .text("Net Pay", 60, y + 12)
    .fontSize(16)
    .text(money(totals.net), 430, y + 8)
    .fillColor("#000");

  // Footer
  doc
    .moveDown(4)
    .fontSize(9)
    .fillColor("#6b7280")
    .text("This is a system generated payslip and does not require a signature.", { align: "center" });

  doc.end();
}
