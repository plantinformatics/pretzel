import {Response} from '@loopback/rest';

export function initSseResponse(res: Response): void {
  res.status(200);
  /* These are done later by reqStream() : express-sse  sse.init(),
   * so it is likely that any difference will be over-ridden.
   * no-transform is not included in express-sse : init(); if it is required it
   * would have to be set after reqStream() : sse.init().
   * Refn : https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
   * If these are commented out, no content is sent.
   */
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  /** Don't .flushHeaders() because reqStream() : express-sse sse.init() also
   * does .setHeader(), which would cause "Error: Cannot set headers after they
   * are sent to the client."
   */
  const flushHeaders = false;
  if (flushHeaders) {
    // Ensure headers are flushed early for streaming clients.
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }
  }
  // Some code paths expect res.flush to exist (express-sse).
  if (typeof (res as any).flush !== 'function') {
    (res as any).flush = () => {
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }
    };
  }
}
