import { logger } from './logger.js';

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  serviceName?: string;
}

/**
 * Robust fetch wrapper with AbortController timeout, exponential backoff, and jitter
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 1000,
    serviceName = 'ExternalAPI',
    ...fetchInit
  } = options;

  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Retry on 5xx server errors or 429 rate limit
      if ((response.status >= 500 || response.status === 429) && attempt < retries) {
        attempt++;
        const jitter = Math.random() * 500;
        const delay = retryDelayMs * Math.pow(2, attempt - 1) + jitter;
        logger.warn(serviceName, `Received status ${response.status}. Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timer);

      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout ? `Request timed out after ${timeoutMs}ms` : err.message;

      if (attempt < retries) {
        attempt++;
        const jitter = Math.random() * 500;
        const delay = retryDelayMs * Math.pow(2, attempt - 1) + jitter;
        logger.warn(serviceName, `Call failed (${errorMessage}). Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      logger.error(serviceName, `Call failed after ${attempt} retries: ${errorMessage}`);
      throw new Error(`[${serviceName}] ${errorMessage}`);
    }
  }
}
