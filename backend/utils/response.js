/**
 * Shared API response contract.
 *
 * Collection endpoints (article list, tag summary) always return the same
 * envelope so callers only have to learn one shape:
 *
 *   { success: true, data: <array>, meta: <object> }
 *
 * Failures use the matching error envelope:
 *
 *   { success: false, error: { code, message } }
 *
 * Single-resource endpoints (article detail, create/update) keep returning
 * the bare resource object, as the existing frontend and detail page depend
 * on those fields directly.
 */

function sendSuccess(res, data, meta = {}, status = 200) {
  return res.status(status).json({ success: true, data, meta });
}

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    error: { code: code || defaultCode(status), message }
  });
}

function defaultCode(status) {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

module.exports = { sendSuccess, sendError };
