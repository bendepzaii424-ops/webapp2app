const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const AdmZip = require("adm-zip");

const { updateJob } = require("./jobStore");

const TEMPLATE_DIR = path.join(__dirname, "..", "..", "mobile-template");
const WORK_ROOT = path.join(__dirname, "..", "work");
const BUILDS_DIR = path.join(__dirname, "..", "builds");

fs.ensureDirSync(WORK_ROOT);
fs.ensureDirSync(BUILDS_DIR);

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let stderr = "";
    proc.stdout.on("data", (d) => process.stdout.write(`[build] ${d}`));
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      process.stderr.write(`[build:err] ${d}`);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Lenh "${cmd} ${args.join(" ")}" that bai (code ${code}): ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Build APK Android tu URL hoac file, nhung khong ghi vao giao dien -
 * chi cap nhat jobStore de frontend poll trang thai.
 */
async function buildAndroidApp({ jobId, source }) {
  const projectDir = path.join(WORK_ROOT, jobId);

  try {
    updateJob(jobId, { status: "building", progress: 5, message: "Dang chuan bi project tu template" });
    await fs.copy(TEMPLATE_DIR, projectDir);

    // 1. Cau hinh nguon noi dung: URL truc tiep hoac file/zip giai nen vao www/
    updateJob(jobId, { progress: 15, message: "Dang cau hinh nguon noi dung" });
    const capacitorConfigPath = path.join(projectDir, "capacitor.config.json");
    const config = await fs.readJson(path.join(projectDir, "capacitor.config.template.json"));

    if (source.type === "url") {
      // Capacitor se dieu huong WebView thang toi URL nay (server.url).
      // MainActivity.java trong template se inject virtual-mouse.js
      // sau khi trang tai xong (onPageFinished), khong bi anh huong CORS
      // vi day la trang top-level, khong phai iframe.
      config.server = { url: source.value, cleartext: true };
    } else {
      const wwwDir = path.join(projectDir, "android", "app", "src", "main", "assets", "public");
      await fs.ensureDir(wwwDir);
      const ext = path.extname(source.originalName || "").toLowerCase();

      if (ext === ".zip") {
        const zip = new AdmZip(source.value);
        zip.extractAllTo(wwwDir, true);
      } else if ([".html", ".htm"].includes(ext)) {
        await fs.copy(source.value, path.join(wwwDir, "index.html"));
      } else {
        // File media/khac: dat trong wrapper HTML don gian
        const fileName = "asset" + ext;
        await fs.copy(source.value, path.join(wwwDir, fileName));
        await fs.writeFile(
          path.join(wwwDir, "index.html"),
          `<!DOCTYPE html><html><body style="margin:0"><embed src="${fileName}" style="width:100%;height:100vh" /></body></html>`
        );
      }
      // Noi dung local -> khong set server.url, Capacitor tu load index.html noi bo
      delete config.server;
    }

    await fs.writeJson(capacitorConfigPath, config, { spaces: 2 });

    // 2. Dong bo Capacitor (copy assets + plugin config vao du an Android)
    updateJob(jobId, { progress: 30, message: "Dang dong bo Capacitor" });
    await run("npx", ["cap", "sync", "android"], projectDir);

    // 3. Build APK debug bang Gradle wrapper
    updateJob(jobId, { progress: 55, message: "Dang bien dich APK (Gradle)" });
    await run("./gradlew", ["assembleDebug"], path.join(projectDir, "android"));

    // 4. Copy APK ra thu muc builds/ de tai xuong
    updateJob(jobId, { progress: 90, message: "Dang dong goi ket qua" });
    const apkSrc = path.join(
      projectDir, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"
    );
    const apkDest = path.join(BUILDS_DIR, `${jobId}.apk`);
    await fs.copy(apkSrc, apkDest);

    updateJob(jobId, {
      status: "done",
      progress: 100,
      message: "Hoan tat",
      downloadUrl: `/downloads/${jobId}.apk`,
    });
  } catch (err) {
    updateJob(jobId, { status: "error", message: err.message });
  } finally {
    // Don dep thu muc lam viec tam (giu lai builds/ de tai xuong)
    fs.remove(projectDir).catch(() => {});
  }
}

module.exports = { buildAndroidApp };
