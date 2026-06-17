require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow React dev server to send cookies
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// SESSION CONFIGURATION
app.use(session({
  secret: process.env.SESSION_SECRET || 'iba_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none', //allows cross-origin cookie sending
    maxAge: 1000 * 60 * 60 * 24 * 7  //7-day session
  }
}));


// ROUTES
const authRoutes      = require('./routes/authRoutes');
const todoRoutes      = require('./routes/to-do');
const progressRoutes  = require('./routes/progress');
const scrapbookRoutes = require('./routes/scrapbook'); // uncomment when upload.js is added


app.use('/api/auth',      authRoutes);
app.use('/api/todo',      todoRoutes);
app.use('/api/progress',  progressRoutes);
app.use('/api/scrapbook', scrapbookRoutes);

// Static file uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets',  express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.send('🚀 Backend API server is running perfectly on Docker!');
});

app.listen(PORT, '0.0.0.0',() => {
  console.log(`🚀 Server running on port ${PORT}`);
});
