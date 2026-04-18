const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const dotenv  = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root route for API health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'HomePro API is running' });
});

// Routes (you'll add these progressively)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/providers', require('./routes/providers'));

// Global error handler — MUST be last
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));