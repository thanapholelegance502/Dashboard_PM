export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? 500;
  const payload = { error: err.message ?? 'internal error' };
  if (err.reauthorize) payload.reauthorize = true; // ให้ frontend ขึ้น banner + ปุ่มพาไป authorize
  if (status >= 500) console.error('[error]', err);
  res.status(status).json(payload);
}
