const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/upload/chunk', upload.single('file'), (req, res) => {
    const { fileKey, chunkIndex } = req.body;

    if (!fileKey || chunkIndex === undefined) {
        return res.status(400).json({ message: 'Missing required parameters.' });
    }

    const chunkDir = path.join(UPLOAD_DIR, fileKey);
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir);

    const chunkPath = path.join(chunkDir, `${chunkIndex}`);
    fs.renameSync(req.file.path, chunkPath);

    res.status(200).json({ message: 'Chunk uploaded successfully.' });
});

app.get('/upload/chunk/status', (req, res) => {
    const { fileKey } = req.query;

    if (!fileKey) {
        return res.status(400).json({ message: 'Missing fileKey parameter.' });
    }

    const chunkDir = path.join(UPLOAD_DIR, fileKey);
    if (!fs.existsSync(chunkDir)) {
        return res.status(200).json({ uploadedChunks: [] });
    }

    const uploadedChunks = fs.readdirSync(chunkDir).map((chunk) => parseInt(chunk, 10));
    res.status(200).json({ uploadedChunks });
});

app.post('/upload/merge', async (req, res) => {
    const { fileKey } = req.body;

    if (!fileKey) {
        return res.status(400).json({ message: 'Missing fileKey parameter.' });
    }

    const chunkDir = path.join(UPLOAD_DIR, fileKey);
    if (!fs.existsSync(chunkDir)) {
        return res.status(400).json({ message: 'FileKey does not exist.' });
    }

    const chunks = fs.readdirSync(chunkDir).map((chunk) => parseInt(chunk, 10));
    if (chunks.length === 0) {
        return res.status(400).json({ message: 'No chunks to merge.' });
    }

    chunks.sort((a, b) => a - b);
    const mergedFilePath = path.join(UPLOAD_DIR, fileKey).replace('-chunk', '');

    const writeStream = fs.createWriteStream(mergedFilePath);
    for (const chunkIndex of chunks) {
        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        fs.unlinkSync(chunkPath);
    }

    writeStream.end();
    writeStream.on('finish', () => {
        fs.rmdirSync(chunkDir);
        res.status(200).json({ message: 'File merged successfully.', filePath: mergedFilePath });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
