// Job store don gian trong bo nho. Trong san xuat, thay bang Redis/DB
// de chiu duoc restart server va scale nhieu instance.
const jobs = new Map();

function createJob(jobId, initial = {}) {
  jobs.set(jobId, {
    status: "queued",     // queued | building | done | error
    progress: 0,          // 0-100
    message: "Da dua vao hang doi",
    downloadUrl: null,
    ...initial,
  });
}

function updateJob(jobId, patch) {
  const current = jobs.get(jobId);
  if (!current) return;
  jobs.set(jobId, { ...current, ...patch });
}

function getJob(jobId) {
  return jobs.get(jobId);
}

module.exports = { createJob, updateJob, getJob };
