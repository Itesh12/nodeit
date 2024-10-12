const express = require('express');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const dotenv = require('dotenv');
const passport = require('passport');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const helmet = require('helmet');
const compression = require('compression');
const userRouter = require('./src/routes/userRoutes');
const communityRouter = require('./src/routes/communityRouter');
const globalErrorHandler = require('./src/controllers/errorController');

require('express-async-errors');

const app = express();

dotenv.config();

// Side effect import
require('./src/controllers/passportController');

// Global Middlewares
app.use(passport.initialize());

// Implement Cors
app.use(cors());
app.options('*', cors());

// Set security HTTP headers
app.use(helmet());

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});

app.use('/', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ['sort'],
  })
);

app.use(compression());

app.use(globalErrorHandler);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    logger.info('MongoDB connection successful!');
  })
  .catch((err) => {
    logger.error('MongoDB connection failed!', err);
    process.exit(1); // Optionally, shut down the app if the DB connection fails
  });

app.get('/', (req, res) => res.send('Hello World!'));
app.use('/api/v1/users', userRouter);
app.use('/api/v1/communities', communityRouter);

const port = process.env.PORT ?? 5000;

const server = app.listen(port, () => {
  logger.info(`App running on port ${port}...`);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err);
  server.close(() => {
    process.exit(1);
  });
});

// quit on ctrl-c when running docker in terminal
process.on('SIGINT', function onSigint() {
  logger.info('👋 SIGINT RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated!');
    process.exit(0);
  });
});
