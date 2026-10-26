/**
 * Error-handling middleware.
 * These run last, so a bad request or an unexpected error returns a JSON
 * message instead of crashing the server.
 * Every error has a "code" that the client translates (EN or TL).
 */

// Runs when no route matched the request URL.
function notFound(req, res) {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' });
}

// Runs when any route throws an error or calls next(error).
// Express knows this is an error handler because it has 4 parameters.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Invalid JSON in the request body (e.g. a missing quote).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'INVALID_JSON', message: 'Invalid JSON in request body.' });
  }

  // Request body larger than the limit in app.js.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ code: 'TOO_LONG', message: 'Request body is too large.' });
  }

  console.error(err);
  res.status(500).json({ code: 'SERVER_ERROR', message: 'Something went wrong on the server.' });
}

module.exports = { notFound, errorHandler };
