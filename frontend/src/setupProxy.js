const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.REACT_APP_API_URL || 'http://localhost:3001';

module.exports = function (app) {
  // /api is also covered by the package.json `proxy` field, but that field
  // skips requests with Accept: text/html (e.g. opening a link in a new tab).
  // Declaring proxies here ensures direct-navigation requests get forwarded too.
  const opts = { target, changeOrigin: true };
  app.use('/api', createProxyMiddleware(opts));
  app.use('/uploads', createProxyMiddleware(opts));
};
