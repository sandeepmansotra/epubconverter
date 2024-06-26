const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const archiver = require('archiver');
const Epub = require('epub-gen');
const stream = require('stream');
const { convertPdfToText } = require('./pdfController');
const ejs = require('ejs');
const { v4: uuidv4 } = require('uuid');

async function addEmbeddedFontToEpub(epubFilePath, customFontFilePath) {
  // Create a temporary directory for extraction
  const tempDir = path.join(__dirname, 'temp');

  try {
    // Step 1: Unzip the EPUB file
    await unzipEpub(epubFilePath, tempDir);

    // Step 2: Read custom font file as Base64
    const fontBase64 = await encodeFontAsBase64(customFontFilePath);

    // Step 3: Modify CSS files to include embedded font
    await modifyCssFiles(tempDir, fontBase64);

    // Step 4: Re-zip the modified EPUB contents
    // await zipEpub(tempDir, outputEpubPath);

    const buffer = await zipEpubToBuffer(tempDir);

    return buffer;
  } catch (error) {
    console.error('Error creating EPUB with embedded font:', error);
  } finally {
    // Step 5: Clean up the temporary directory
    await cleanUp(tempDir);
  }
}

async function unzipEpub(epubFileBUffer, tempDir) {
  try {
    // Create temporary directory if it doesn't exist
    // await fs.mkdir(tempDir, { recursive: true });

    // // Extract EPUB file contents
    // await fss
    //   .createReadStream(epubFilePath)
    //   .pipe(unzipper.Extract({ path: tempDir }))
    //   .promise();

    const bufferStream = new stream.PassThrough();
    bufferStream.end(epubFileBUffer);

    // Pipe the buffer stream through unzipper to extract its contents
    await bufferStream.pipe(unzipper.Extract({ path: tempDir })).promise();

    console.log('EPUB file unzipped successfully.');
  } catch (error) {
    console.error('Error unzipping EPUB file:', error);
    throw error;
  }
}

async function encodeFontAsBase64(customFontFilePath) {
  try {
    // Read custom font file as binary
    const fontData = await fs.readFile(customFontFilePath);

    // Convert to Base64 encoding
    const fontBase64 = fontData.toString('base64');

    console.log('Custom font encoded as Base64.');
    return fontBase64;
  } catch (error) {
    console.error('Error encoding custom font as Base64:', error);
    throw error;
  }
}

async function modifyCssFiles(tempDir, fontBase64) {
  try {
    // Find all CSS files in the EPUB directory
    const cssFiles = await findCssFiles(tempDir);

    // Modify each CSS file to include embedded font
    await Promise.all(
      cssFiles.map(async (file) => {
        let cssContent = await fs.readFile(file, 'utf-8');

        // Replace existing font-family with embedded font
        cssContent += `\n@font-face {
                font-family: 'EmbeddedFont';
                src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
            }
            body {
                font-family: 'EmbeddedFont', Arial, sans-serif;
            }`;

        cssContent = cssContent.replace(/font-family:\s*['"][^'"]*['"]/g, `font-family: 'EmbeddedFont'`);

        // Write modified CSS back to the file
        await fs.writeFile(file, cssContent, 'utf-8');
      }),
    );

    console.log('CSS files modified to include embedded font.');
  } catch (error) {
    console.error('Error modifying CSS files:', error);
    throw error;
  }
}

async function findCssFiles(dir) {
  let cssFiles = [];
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      cssFiles = cssFiles.concat(await findCssFiles(filePath));
    } else if (file.toLowerCase().endsWith('.css')) {
      cssFiles.push(filePath);
    }
  }

  return cssFiles;
}

async function zipEpub(tempDir, outputEpubPath) {
  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fss.createWriteStream(outputEpubPath);

    archive.pipe(output);
    archive.directory(tempDir, false);
    await archive.finalize();

    console.log(`EPUB file with embedded font created successfully: ${outputEpubPath}`);
  } catch (error) {
    console.error('Error zipping EPUB file:', error);
    throw error;
  }
}

async function zipEpubToBuffer(tempDir) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const buffers = [];

    archive.on('error', reject);

    archive.on('data', function (buffer) {
      buffers.push(buffer);
    });

    archive.on('end', function () {
      const buffer = Buffer.concat(buffers);
      resolve(buffer);
    });

    archive.directory(tempDir, false);
    archive.finalize();
  });
}

async function cleanUp(tempDir) {
  try {
    // Delete the temporary directory and its contents
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log('Temporary directory cleaned up.');
  } catch (error) {
    console.error('Error cleaning up temporary directory:', error);
    throw error;
  }
}

// Example usage:
const customFontFilePath = path.join(__dirname, '../Fast_Sans.ttf'); // Replace with your custom font file path

const customFontToEpub = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    console.log(req.file, 'File');
    const filePath = req.file.buffer;
    const result = await addEmbeddedFontToEpub(filePath, customFontFilePath);

    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', 'attachment; filename="generated.epub"');

    res.status(200).send(result);
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).send('Error processing file');
  }
};

async function convertHtmlToEpub(htmlContent) {
  try {
    const filename = `generated_${uuidv4()}.epub`;
    const filePath = path.join(__dirname, filename);
    // Extract title from HTML content (you can customize this logic)
    const title = getTitleFromHtml(htmlContent) || 'Converted EPUB';
    // Configuration options for EPUB generation
    const options = {
      title,
      author: '',
      output: filePath,
      content: [
        {
          title: 'Chapter 1', // Chapter title
          data: htmlContent, // HTML content of the chapter
        },
      ],
    };
    // Generate EPUB file
    await new Epub(options).promise;
    return { filePath, filename };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Function to extract title from HTML content (you can customize this logic)
function getTitleFromHtml(htmlContent) {
  const match = /<title>(.*?)<\/title>/i.exec(htmlContent);
  return match ? match[1] : null;
}

const convertAnyToEpub = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    if (req.file.mimetype === 'application/pdf') {
      const fileBuffer = req.file.buffer;
      const text = await convertPdfToText(fileBuffer);

      const templateString = await fs.readFile(path.join(__dirname, '../template.ejs'), 'utf-8');
      const html = ejs.render(templateString, { text });
      const { filePath, filename } = await convertHtmlToEpub(html);

      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Send the EPUB file as response
      const epubStream = fss.createReadStream(filePath);
      epubStream.pipe(res);

      console.log('EPUB file sent as response.');

      // Delete the EPUB file after sending the response
      epubStream.on('close', () => {
        fs.unlink(filePath)
          .then(() => console.log(`Deleted EPUB file: ${filePath}`))
          .catch((err) => console.error(`Error deleting EPUB file: ${filePath}`, err));
      });
    } else {
      customFontToEpub(req, res);
    }
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file');
  }
};

module.exports = { customFontToEpub, convertAnyToEpub };
