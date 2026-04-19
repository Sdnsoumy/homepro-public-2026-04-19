const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const { startBadgeCron } = require('./jobs/badgeCron');

dotenv.config();

// Start cron job after DB connection established
connectDB().then(() => {
  startBadgeCron();
});

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploads folder as static files for downloading review photos and user uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route for API health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'HomePro API is running' });
});

// Routes (you'll add these progressively)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/sos', require('./routes/sos'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews',  require('./routes/reviews'));

// Global error handler — MUST be last
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));