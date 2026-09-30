import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generates a PDF quotation based on the provided JSON data.
 * @param {Object} quoteData - The data extracted from the LLM.
 * @param {string} quoteData.customerName - Name of the customer.
 * @param {Array} quoteData.items - Array of { product, quantity, price }.
 * @returns {Promise<string>} The file path to the generated PDF.
 */
export async function generateQuotationPDF(quoteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `Quotation_${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'temp', fileName);
      
      // Ensure temp directory exists
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('TECHBOTT INDIA', { align: 'center' });
      doc.fontSize(10).text('Quotation for Printing & Laser Solutions', { align: 'center' });
      doc.moveDown();
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.text(`Prepared For: ${quoteData.customerName || 'Valued Customer'}`);
      doc.moveDown(2);

      // Table Header
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Item Description', 50, doc.y, { continued: true, width: 250 });
      doc.text('Qty', 300, doc.y, { continued: true, width: 50 });
      doc.text('Unit Price ($)', 350, doc.y, { continued: true, width: 100 });
      doc.text('Total ($)', 450, doc.y);
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown(1);

      // Table Rows
      doc.font('Helvetica');
      let grandTotal = 0;
      for (const item of quoteData.items) {
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const total = qty * price;
        grandTotal += total;

        const startY = doc.y;
        doc.text(item.product, 50, startY, { width: 250 });
        doc.text(qty.toString(), 300, startY, { width: 50 });
        doc.text(price.toFixed(2), 350, startY, { width: 100 });
        doc.text(total.toFixed(2), 450, startY);
        doc.moveDown(0.5);
      }

      // Total
      doc.moveDown(1);
      doc.moveTo(350, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold');
      doc.text('Grand Total:', 350, doc.y, { continued: true, width: 100 });
      doc.text(`$${grandTotal.toFixed(2)}`, 450, doc.y);
      
      doc.moveDown(4);
      doc.font('Helvetica').fontSize(10);
      doc.text('Terms and Conditions:', { underline: true });
      doc.text('1. This quotation is valid for 30 days.');
      doc.text('2. Standard shipping rates apply unless otherwise negotiated.');
      doc.text('3. Contact sales at +91 7337335751 for order processing.');

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}
