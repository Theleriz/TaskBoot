// Ticks come from a Web Worker: browsers barely throttle worker timers in background tabs,
// so the end of a timer is noticed on time. The time itself is always computed from Date.now().
// A plain interval runs as a backup in case the worker cannot start (some file:// setups).

export function startTicker(onTick: () => void, intervalMs = 250): () => void {
  const stops: Array<() => void> = [];

  const backup = setInterval(onTick, 1000);
  stops.push(() => clearInterval(backup));

  try {
    const source = `setInterval(function(){postMessage(0)},${intervalMs})`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = onTick;
    stops.push(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
    });
  } catch {
    const fast = setInterval(onTick, intervalMs);
    stops.push(() => clearInterval(fast));
  }

  return () => stops.forEach((stop) => stop());
}
