const express = require('express');
const multer = require('multer');
const conversionController = require('../controllers/convertController');
const { customFontToEpub,  convertAnyToEpub } = require('../controllers/epubController');
const { epubToTextController, epubToHTMLController } = require('../controllers/epubToTextController');
const { convertPdfToBoldPdf } = require('../controllers/pdfController');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/pdf/gettext', upload.single('file'), conversionController.convertPdfToTextController);
router.post('/epub/gettext', upload.single('file'), epubToTextController);
router.post('/epub/getHTML', upload.single('file'), epubToHTMLController);
router.post('/epub/convert', upload.single('file'), customFontToEpub);
router.post('/pdf/convert', upload.single('file'), convertPdfToBoldPdf);
router.post('/convert', upload.single('file'), convertAnyToEpub);


module.exports = router;
