import PQueue from 'p-queue';
import { runWorker } from './worker.ts';
import { v4 as uuidv4 } from 'uuid';

// In-memory job storage since Redis is not available in AI Studio environment
const jobs = new Map<string, any>();
const queue = new PQueue({ concurrency: 1 });

export async function addJob(data: { url?: string; filePath?: string }) {
  const id = uuidv4();
  
  const job = {
    id,
    ...data,
    status: 'pending',
    result: null,
    progress: 0,
    createdAt: new Date(),
  };

  jobs.set(id, job);

  queue.add(() => processJob(id)).catch(err => {
    console.error(`Error processing job ${id}:`, err);
    updateJob(id, { status: 'failed', error: err.message });
  });

  return id;
}

async function processJob(id: string) {
  const job = jobs.get(id);
  if (!job) return;

  job.status = 'processing';
  
  try {
    const result = await runWorker(job, (progress: number) => {
      job.progress = progress;
    });
    
    job.status = 'completed';
    job.result = result;
    job.progress = 100;
  } catch (error: any) {
    console.error(`Worker failed for job ${id}:`, error);
    job.status = 'failed';
    job.error = error.message;
  }
}

function updateJob(id: string, updates: Partial<any>) {
  const job = jobs.get(id);
  if (job) {
    jobs.set(id, { ...job, ...updates });
  }
}

export function getJobStatus(id: string) {
  return jobs.get(id);
}
