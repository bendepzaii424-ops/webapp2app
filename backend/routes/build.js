const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs-extra");

const { createJob, getJob } = require("../services/jobStore");
const { buildAndroidApp } = require("../services/androidBuilder");
const { buildIosApp } = require("../services/iosBuilder");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.ensureDirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 500 * 1024 * 1024 } });

// POST /api/build  { platform, sourceType, url? , file? }
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { platform, sourceType, url } = req.body;

    if (!["android", "ios"].includes(platform)) {
      return res.status(400).json({ error: "platform phai la 'android' hoac 'ios'" });
    }
    if (sourceType === "url" && !url) {
      return res.status(400).json({ error: "Thieu url" });
    }
    if (sourceType === "file" && !req.file) {
      return res.status(400).json({ error: "Thieu file tai len" });
    }

    const jobId = uuidv4();
    createJob(jobId);

    const source =
      sourceType === "url"
        ? { type: "url", value: url }
        : { type: "file", value: req.file.path, originalName: req.file.originalname };

    // Chay build o background, khong chan request tra ve jobId ngay
    const builder = platform === "android" ? buildAndroidApp : buildIosApp;
    builder({ jobId, source }).catch((err) => {
      console.error(`[build:${jobId}] that bai:`, err);
    });

    res.json({ jobId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Loi server khi tao job build" });
  }
});

// GET /api/build/:jobId/status
router.get("/:jobId/status", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Khong tim thay job" });
  res.json(job);
});

module.exports = router;
