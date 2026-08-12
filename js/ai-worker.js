import { pipeline, env } from '@xenova/transformers';

// We rely entirely on the Hugging Face hub (remote models)
env.allowLocalModels = false;
env.useBrowserCache = true;

const instances = {};

self.addEventListener('message', async (e) => {
  const { id, task, model, args } = e.data;
  try {
    if (!instances[model]) {
      self.postMessage({ id, status: 'loading' });
      instances[model] = pipeline(task, model, {
        progress_callback: (x) => {
          self.postMessage({ id, status: 'progress', data: x });
        }
      });
    }
    self.postMessage({ id, status: 'inferring' });
    const pipe = await instances[model];
    const result = await pipe(...args);
    self.postMessage({ id, status: 'complete', result });
  } catch (error) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
});
