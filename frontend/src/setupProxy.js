const { createProxyMiddleware } = require('http-proxy-middleware');

// API target may include /api suffix (e.g. http://localhost:3001/api); extract the origin for file proxying
const apiTarget = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const backendOrigin = apiTarget.replace(/\/api$/, '');

module.exports = function (app) {
  // /api is also covered by the package.json `proxy` field, but that field
  // skips requests with Accept: text/html (e.g. opening a link in a new tab).
  // Declaring proxies here ensures direct-navigation requests get forwarded too.
  app.use('/api', createProxyMiddleware({ target: apiTarget, changeOrigin: true }));
  // Express strips the mount-point prefix before passing req.url to the middleware,
  // so we must rewrite the path to add /uploads back before forwarding to the backend.
  app.use('/uploads', createProxyMiddleware({ target: backendOrigin, changeOrigin: true, pathRewrite: { '^/': '/uploads/' } }));
};
