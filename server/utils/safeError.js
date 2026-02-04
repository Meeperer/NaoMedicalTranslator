/**
 * Returns a message safe to send to the client. In production we do not expose
 * internal error details (paths, stack traces, or API messages).
 */
export function getClientErrorMessage(err) {
  if (process.env.NODE_ENV === 'production') {
    return 'Something went wrong. Please try again.';
  }
  return err?.message || 'Unknown error';
}
