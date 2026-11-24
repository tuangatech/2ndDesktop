// A first version of the measurement sampler (tech design 3.7, NFR-1 to NFR-4). It logs the CPU and memory
// of all the app's processes now and then. Step 6 replaces it with the diagnostics log (app/main/diagnostics.js).
import { app } from 'electron';

/**
 * @param {(message: string) => void} log
 * @param {number} intervalMs
 */
export function startSampler(log, intervalMs) {
  app.getGPUInfo('basic').then(
    (info) => {
      const devices = (info.gpuDevice ?? []).map(
        (d) => `vendor ${d.vendorId} device ${d.deviceId}${d.active ? ' (active)' : ''}`,
      );
      log(`gpu: ${devices.join('; ')}`);
    },
    () => log('gpu: unknown'),
  );
  return setInterval(() => {
    const metrics = app.getAppMetrics();
    const cpu = metrics.reduce((sum, m) => sum + m.cpu.percentCPUUsage, 0);
    const memoryKB = metrics.reduce(
      (sum, m) => sum + (m.memory.privateBytes ?? m.memory.workingSetSize),
      0,
    );
    const parts = metrics.map(
      (m) =>
        `${m.type} ${((m.memory.privateBytes ?? m.memory.workingSetSize) / 1024).toFixed(0)} MB`,
    );
    log(
      `sample: cpu ${cpu.toFixed(1)}% of one core, memory ${(memoryKB / 1024).toFixed(0)} MB (${parts.join(', ')})`,
    );
  }, intervalMs);
}
