import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
if (config.usingDevJwtSecret) {
  console.warn(
    'JWT_SECRET is not set: using the public development secret. Do not use in production.',
  );
}
const app = createApp(db, config);

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (db: ${config.databasePath})`);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Do not hang forever on keep-alive connections or slow clients.
  const force = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close(() => {
    try {
      db.close();
    } catch (error) {
      console.error('Error closing database:', error);
    }
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
