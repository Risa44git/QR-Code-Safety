require('dotenv').config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const qrDecoder = require("./src/qrDecoder");
const riskEngine = require("./src/riskEngine");

const app = express();
app.use(cors());

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

    // 2. risk analysis
    const result = await riskEngine(url);

    // 3. response
    return res.json({
      url,
      ...result
    });

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