
const jobs = new Map();

function createJob(jobId, initial = {}) {
  jobs.set(jobId, {
    status: "queued",     
    progress: 0,          
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
