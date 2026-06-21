require('dotenv').config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const qrDecoder = require("./src/qrDecoder");
const riskEngine = require("./src/riskEngine");
const analyzeContent = require("./src/contentAnalyzer");

const app = express();
app.use(cors());
app.use(express.json());

// store file in memory (NOT disk)
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/analyze-qr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // 1. decode QR → URL
    const url = await qrDecoder(req.file.buffer);

    if (!url) {
      return res.status(400).json({ error: "No QR code found in image" });
    }

    // 2. detect content type — non-URL codes skip riskEngine
    const nonUrlResult = analyzeContent(url);
    if (nonUrlResult) {
      return res.json({ url, ...nonUrlResult });
    }

    // 3. URL risk analysis
    const result = await riskEngine(url);

    // 4. response
    return res.json({
      url,
      ...result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

app.post("/api/analyze-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });
    const nonUrlResult = analyzeContent(url);
    if (nonUrlResult) return res.json({ url, ...nonUrlResult });
    const result = await riskEngine(url);
    return res.json({ url, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// Catch-all: handles errors thrown by multer or other middleware
// before the route handler runs — ensures response is always JSON
app.use((err, req, res, next) => {
  console.error("Unhandled middleware error:", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

app.listen(3001, () => {
  console.log("QR API running on http://localhost:3001");
});