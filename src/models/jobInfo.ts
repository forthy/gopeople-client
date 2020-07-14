export { JobId, jobIdOf, TrackingCode, trackingCodeOf, JobInfo };

class JobId {
  constructor(readonly id: string) {}
}

function jobIdOf(id: string): JobId {
  return new JobId(id);
}

class TrackingCode {
  constructor(readonly code: string) {}
}

function trackingCodeOf(code: string): TrackingCode {
  return new TrackingCode(code);
}

class JobInfo {
  constructor(readonly id: JobId, readonly code: TrackingCode) {}
}
