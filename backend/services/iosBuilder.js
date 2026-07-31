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

// QUAN TRONG: build IPA bat buoc phai chay tren may macOS co cai Xcode
// va co Apple Developer certificate + provisioning profile hop le.
// Neu backend Node nay dang chay tren Linux, ban can:
//   - Dat toan bo tien trinh nay tren 1 Mac agent (Mac mini/MacStadium/
//     GitHub Actions macos runner/Codemagic...), HOAC
//   - Sua ham run() ben duoi de SSH vao Mac agent va thuc thi tu xa,
//     roi scp file .ipa ket qua ve lai server nay.
const EXPORT_OPTIONS_PLIST = path.join(TEMPLATE_DIR, "ios", "ExportOptions.plist");

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let stderr = "";
    proc.stdout.on("data", (d) => process.stdout.write(`[ios-build] ${d}`));
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      process.stderr.write(`[ios-build:err] ${d}`);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Lenh "${cmd} ${args.join(" ")}" that bai (code ${code}): ${stderr.slice(-500)}`));
    });
  });
}

async function buildIosApp({ jobId, source }) {
  const projectDir = path.join(WORK_ROOT, jobId);

  try {
    if (process.platform !== "darwin") {
      throw new Error(
        "Build IPA yeu cau chay tren macOS voi Xcode da cai dat. " +
        "Vui long cau hinh mot Mac build agent (xem README)."
      );
    }

    updateJob(jobId, { status: "building", progress: 5, message: "Dang chuan bi project tu template" });
    await fs.copy(TEMPLATE_DIR, projectDir);

    updateJob(jobId, { progress: 15, message: "Dang cau hinh nguon noi dung" });
    const config = await fs.readJson(path.join(projectDir, "capacitor.config.template.json"));

    if (source.type === "url") {
      config.server = { url: source.value };
    } else {
      const wwwDir = path.join(projectDir, "ios", "App", "App", "public");
      await fs.ensureDir(wwwDir);
      const ext = path.extname(source.originalName || "").toLowerCase();
      if (ext === ".zip") {
        new AdmZip(source.value).extractAllTo(wwwDir, true);
      } else {
        await fs.copy(source.value, path.join(wwwDir, "index.html"));
      }
      delete config.server;
    }
    await fs.writeJson(path.join(projectDir, "capacitor.config.json"), config, { spaces: 2 });

    updateJob(jobId, { progress: 30, message: "Dang dong bo Capacitor" });
    await run("npx", ["cap", "sync", "ios"], projectDir);

    updateJob(jobId, { progress: 45, message: "Dang cai CocoaPods" });
    await run("pod", ["install"], path.join(projectDir, "ios", "App"));

    updateJob(jobId, { progress: 60, message: "Dang build va ky (archive)" });
    const archivePath = path.join(projectDir, "build", "App.xcarchive");
    await run(
      "xcodebuild",
      [
        "-workspace", "App.xcworkspace",
        "-scheme", "App",
        "-configuration", "Release",
        "-archivePath", archivePath,
        "archive",
      ],
      path.join(projectDir, "ios", "App")
    );

    updateJob(jobId, { progress: 85, message: "Dang xuat file IPA" });
    const exportDir = path.join(projectDir, "build", "export");
    await run(
      "xcodebuild",
      [
        "-exportArchive",
        "-archivePath", archivePath,
        "-exportOptionsPlist", EXPORT_OPTIONS_PLIST,
        "-exportPath", exportDir,
      ],
      projectDir
    );

    const ipaFiles = (await fs.readdir(exportDir)).filter((f) => f.endsWith(".ipa"));
    if (!ipaFiles.length) throw new Error("Khong tim thay file .ipa sau khi export");

    const ipaDest = path.join(BUILDS_DIR, `${jobId}.ipa`);
    await fs.copy(path.join(exportDir, ipaFiles[0]), ipaDest);

    updateJob(jobId, {
      status: "done",
      progress: 100,
      message: "Hoan tat",
      downloadUrl: `/downloads/${jobId}.ipa`,
    });
  } catch (err) {
    updateJob(jobId, { status: "error", message: err.message });
  } finally {
    fs.remove(projectDir).catch(() => {});
  }
}

module.exports = { buildIosApp };
