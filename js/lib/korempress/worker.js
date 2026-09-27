/* Runs the Korempress container off the main thread. One job per message. */
import { packPdf, unpackPdf, packFile, unpackFile } from './container.js';

self.onmessage = async ({ data: { id, op, bytes, name, level } }) => {
  const onProgress = (f, label) => self.postMessage({ id, progress: f, label });
  try {
    let result;
    if (op === 'packPdf') result = await packPdf(bytes, { level, onProgress });
    else if (op === 'unpackPdf') result = { bytes: await unpackPdf(bytes, { onProgress }) };
    else if (op === 'packFile') result = { bytes: await packFile(bytes, name, { level }) };
    else if (op === 'unpackFile') result = await unpackFile(bytes);
    else throw new Error(`Unknown job ${op}`);
    self.postMessage({ id, result }, [result.bytes.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
