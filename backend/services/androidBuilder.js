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


async function buildAndroidApp({ jobId, source }) {

  if (process.env.RENDER || !process.env.ANDROID_HOME) {
    try {
      console.log(`[Mock Build] Bat dau gia lap build cho Job: ${jobId}`);
      
      updateJob(jobId, { status: "building", progress: 10, message: "Dang chuan bi project (Demo Render)..." });
      await new Promise((r) => setTimeout(r, 1000));

      updateJob(jobId, { progress: 40, message: "Dang cau hinh va dong bo Capacitor..." });
      await new Promise((r) => setTimeout(r, 1200));

      updateJob(jobId, { progress: 75, message: "Dang biendich file APK (Mo phong)..." });
      await new Promise((r) => setTimeout(r, 1500));

     
      const mockApkDest = path.join(BUILDS_DIR, `${jobId}.apk`);
      await fs.writeFile(mockApkDest, "File APK demo duoc tao tu Render.");

      updateJob(jobId, {
        status: "done",
        progress: 100,
        message: "Hoan tat (Phien ban Demo Render)!",
        downloadUrl: `/downloads/${jobId}.apk`,
      });
      return;
    } catch (err) {
      updateJob(jobId, { status: "error", message: err.message });
      return;
    }
  }

  const projectDir = path.join(WORK_ROOT, jobId);

  try {
    updateJob(jobId, { status: "building", progress: 5, message: "Dang chuan bi project tu template" });
    await fs.copy(TEMPLATE_DIR, projectDir);

   
    updateJob(jobId, { progress: 15, message: "Dang cau hinh nguon noi dung" });
    const capacitorConfigPath = path.join(projectDir, "capacitor.config.json");
    const config = await fs.readJson(path.join(projectDir, "capacitor.config.template.json"));

    if (source.type === "url") {
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
        const fileName = "asset" + ext;
        await fs.copy(source.value, path.join(wwwDir, fileName));
        await fs.writeFile(
          path.join(wwwDir, "index.html"),
          `<!DOCTYPE html><html><body style="margin:0"><embed src="${fileName}" style="width:100%;height:100vh" /></body></html>`
        );
      }
      delete config.server;
    }

    await fs.writeJson(capacitorConfigPath, config, { spaces: 2 });

    updateJob(jobId, { progress: 30, message: "Dang dong bo Capacitor" });
    await run("npx", ["cap", "sync", "android"], projectDir);

    updateJob(jobId, { progress: 55, message: "Dang bien dich APK (Gradle)" });
    await run("./gradlew", ["assembleDebug"], path.join(projectDir, "android"));

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
    fs.remove(projectDir).catch(() => {});
  }
}

module.exports = { buildAndroidApp };
