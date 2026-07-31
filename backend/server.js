const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const rateLimit = require("express-rate-limit");

const buildRoutes = require("./routes/build");

const app = express();

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use(cors());
app.use(express.json());

// 2. Chống Bot / Spam Request cho API Build (Tối đa 5 lượt build/15 phút mỗi IP)
const buildLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5,
    message: { error: "Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau 15 phút!" }
});
app.use("/api/build", buildLimiter);

const BUILDS_DIR = path.join(__dirname, "builds");
fs.ensureDirSync(BUILDS_DIR);
app.use("/downloads", express.static(BUILDS_DIR));


app.use("/api/build", buildRoutes);
app.get("/health", (req, res) => res.json({ ok: true }));


app.use(express.static(path.join(__dirname, "../frontend")));
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// 6. Khởi chạy Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
