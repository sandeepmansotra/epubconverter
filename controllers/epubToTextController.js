const EPub = require('epub');
const cheerio = require('cheerio');

async function extractTextFromEPUB(epubPath) {
  try {
    const epub = new EPub(epubPath);
    await new Promise((resolve, reject) => {
      epub.on('end', () => resolve());
      epub.on('error', (err) => reject(err));
      epub.parse();
    });
    let text = '';
    for (const chapter of epub.flow) {
      text += await new Promise((resolve, reject) => {
        epub.getChapter(chapter.id, (err, chapterText) => {
          if (err) {
            reject(err);
          } else {
            resolve(chapterText);
          }
        });
      });
    }
    return text;
  } catch (error) {
    console.error('Error parsing EPUB:', error);
    throw error;
  }
}

const epubToHTMLController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    const filePath = req.file.buffer;
    const chapter = await extractTextFromEPUB(filePath);
    res.status(200).send(chapter);
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).send('Error processing file');
  }
};

const epubToTextController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    const filePath = req.file.buffer;
    const chapter = await extractTextFromEPUB(filePath);
    const htmlContent = ` <html>
    <body>
    ${chapter}
    </body>
    </html>
    `;

    const $ = cheerio.load(htmlContent);

    // Extract text from body element
    const bodyText = $('body').text();
    res.status(200).send(bodyText);
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).send('Error processing file');
  }
};

module.exports = { epubToHTMLController, epubToTextController };
