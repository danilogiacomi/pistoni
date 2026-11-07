// Rilevamento dell'altezza: McLeod Pitch Method (NSDF) con interpolazione parabolica.

export function detectPitch(buf, sampleRate, { minFreq = 70, maxFreq = 1600, rmsGate = 0.012 } = {}) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < rmsGate) return { freq: 0, clarity: 0, rms };

  const maxLag = Math.min(Math.floor(sampleRate / minFreq), n - 1);
  const minLag = Math.floor(sampleRate / maxFreq);
  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i < n - tau; i++) {
      const a = buf[i];
      const b = buf[i + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // picchi positivi dopo ogni attraversamento dello zero
  const peaks = [];
  let tau = minLag;
  while (tau < maxLag && nsdf[tau] > 0) tau++; // salta la prima zona positiva
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = tau;
    while (tau < maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    if (best < maxLag && nsdf[best] > 0) peaks.push(best);
  }
  if (!peaks.length) return { freq: 0, clarity: 0, rms };
  const highest = Math.max(...peaks.map((p) => nsdf[p]));
  const threshold = 0.88 * highest;
  const chosen = peaks.find((p) => nsdf[p] >= threshold);

  // interpolazione parabolica
  const y0 = nsdf[chosen - 1] ?? nsdf[chosen];
  const y1 = nsdf[chosen];
  const y2 = nsdf[chosen + 1] ?? nsdf[chosen];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const period = chosen + shift;
  return { freq: sampleRate / period, clarity: y1, rms };
}
