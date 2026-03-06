const http = require('http');
const app = require('./app');
const { initializeSocket } = require('./socket/socketManager');
const connectDB = require('./config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(` Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err.message);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  process.exit(1);
});

module.exports = server;
