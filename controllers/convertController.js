const pdfParse = require('pdf-parse');

const convertPdfToTextController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const fileBuffer = req.file.buffer;
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text;
    res.json({ text: extractedText });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { convertPdfToTextController };
