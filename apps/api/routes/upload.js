const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToIPFS } = require('../services/ipfsUploader');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
    console.log('POST /upload-to-ipfs called');

    if (!req.file) {
        console.log('No file received');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
    });

    try {
        const filePath = req.file.path;
        const originalName = req.file.originalname;

        const result = await uploadToIPFS(filePath, originalName);

        fs.unlinkSync(filePath); // clean up

        res.json(result);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;
