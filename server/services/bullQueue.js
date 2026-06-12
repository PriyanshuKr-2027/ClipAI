// server/services/bullQueue.js
// Bull-based job queue with transparent in-memory fallback when Redis is unavailable.
// Uses CommonJS (require/module.exports) to match server "type": "commonjs".

let Bull;
try { Bull = require('bull'); } catch (_) { Bull = null; }

let exportQueue = null;
let renderQueue = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Probe Redis without throwing or leaking unhandled error events.
 * Returns true if Redis is reachable, false otherwise.
 */
async function tryRedisConnection() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let client;
    try {
      const Redis = require('ioredis');
      client = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,  // never retry
        connectTimeout: 3000,
        enableOfflineQueue: false,
      });

      // Suppress unhandled error events from the probe client
      client.on('error', () => {});

      client.connect()
        .then(() => client.ping())
        .then(() => { client.disconnect(); done(true); })
        .catch(() => { try { client.disconnect(); } catch (_) {} done(false); });

      // Hard timeout safety net
      setTimeout(() => done(false), 4000);
    } catch {
      done(false);
    }
  });
}

/**
 * Minimal Bull-compatible in-memory queue.
 * Supports: .add(data) → job, .process(fn), .on(event, cb), .getJob(id)
 */
function createInMemoryQueue(name) {
  const jobs = new Map();
  const handlers = {};
  let idCounter = 0;

  return {
    _name: name,
    _type: 'in-memory',

    add(data, opts = {}) {
      const id = String(++idCounter);
      const job = {
        id,
        data,
        _progress: 0,
        /** Bull-compatible progress updater */
        progress(pct) {
          this._progress = pct;
          handlers.progress?.(this, pct);
          return Promise.resolve();
        },
      };
      jobs.set(id, job);

      setImmediate(async () => {
        try {
          const result = await handlers.process?.(job);
          handlers.completed?.(job, result);
        } catch (err) {
          handlers.failed?.(job, err);
        }
      });

      return Promise.resolve(job);
    },

    process(handler) {
      handlers.process = handler;
    },

    on(event, cb) {
      handlers[event] = cb;
    },

    async getJob(id) {
      return jobs.get(id) || null;
    },
  };
}

/**
 * Initialize both queues.
 * Call once at server start; safe to call multiple times.
 */
async function initQueues() {
  if (exportQueue && renderQueue) return; // already initialised

  let redisAvailable = false;
  if (Bull) {
    redisAvailable = await tryRedisConnection();
  }

  if (Bull && redisAvailable) {
    exportQueue = new Bull('export', REDIS_URL);
    renderQueue = new Bull('render', REDIS_URL);
    // Suppress unhandled Bull/ioredis error events when Redis drops
    exportQueue.on('error', (err) => console.warn('[Bull] exportQueue error:', err.message));
    renderQueue.on('error', (err) => console.warn('[Bull] renderQueue error:', err.message));
    console.log('[Bull] Using Redis queue at', REDIS_URL);
  } else {
    if (!Bull) {
      console.warn('[Bull] `bull` package not installed — using in-memory job queue');
    } else {
      console.log('[Bull] Redis unavailable — using in-memory job queue');
    }
    exportQueue = createInMemoryQueue('export');
    renderQueue = createInMemoryQueue('render');
  }
}

/**
 * Resolve job status from either a real Bull job or an in-memory job.
 * Returns: { id, status, progress, result?, error? }
 */
async function getJobStatus(jobId) {
  for (const queue of [exportQueue, renderQueue]) {
    if (!queue) continue;
    const job = await queue.getJob(String(jobId));
    if (!job) continue;

    // Real Bull job
    if (typeof job.getState === 'function') {
      const state = await job.getState();
      return {
        id: job.id,
        status: state, // 'waiting' | 'active' | 'completed' | 'failed'
        progress: job._progress ?? 0,
        result: job.returnvalue ?? undefined,
        error: job.failedReason ?? undefined,
      };
    }

    // In-memory job
    return {
      id: job.id,
      status: 'active',
      progress: job._progress ?? 0,
    };
  }

  return null;
}

// Kick off initialisation immediately on require()
initQueues().catch(console.error);

module.exports = {
  initQueues,
  getJobStatus,
  get exportQueue() { return exportQueue; },
  get renderQueue() { return renderQueue; },
};
