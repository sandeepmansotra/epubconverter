const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');

const path = require('path');
const ejs = require('ejs');

const convertPdfToText = async (fileBuffer) => {
  try {
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text;
    return extractedText;
  } catch (error) {
    throw new Error(error?.message);
  }
};

async function convertPdfToBoldPdf(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const text = await convertPdfToText(fileBuffer);

    const templateString = await fs.readFile(path.join(__dirname, '../template.ejs'), 'utf-8');
    const html = ejs.render(templateString, { text });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set content and generate PDF
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });

    // Cleanup
    await browser.close();

    // Set headers for the response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="generated.pdf"');

    // Send the PDF buffer as response
    res.send(pdfBuffer);

    console.log('PDF sent as response.');
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file');
  }
}

module.exports = { convertPdfToBoldPdf, convertPdfToText };
