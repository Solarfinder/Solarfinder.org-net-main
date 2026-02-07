/**
 * Secure File Explorer Backend API
 * Provides authenticated access to manifest.json files
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'your-secure-api-key-here';
const NODE_ENV = process.env.NODE_ENV || 'development';

// === MIDDLEWARE ===

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:8000'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('.')); // Serve static files

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter limit for manifest endpoint
  message: 'Too many manifest requests, please try again later.'
});

app.use(limiter);

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// === CONFIGURATION ===

// Whitelist of allowed folders - configure these to your needs
const ALLOWED_FOLDERS = [
  'pub_ab',
  'pub_ab/Expeditionary_Force',
  'assets',
  'assets/documents'
];

// === HELPER FUNCTIONS ===

/**
 * Validate API key from request headers
 */
function validateApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  return apiKey === API_KEY;
}

/**
 * Validate folder path to prevent directory traversal
 */
function validateFolderPath(folderPath) {
  // Check for path traversal attempts
  if (folderPath.includes('..') || folderPath.includes('//') || folderPath.startsWith('/')) {
    return false;
  }

  // Normalize path
  const normalizedPath = path.normalize(folderPath);
  
  // Check if it's in whitelist
  return ALLOWED_FOLDERS.some(allowed => 
    normalizedPath === allowed || normalizedPath.startsWith(allowed + path.sep)
  );
}

/**
 * Check if file exists and is readable
 */
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// === ROUTES ===

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

/**
 * Main manifest API endpoint
 * GET /api/manifest?folder=path/to/folder
 */
app.get('/api/manifest', strictLimiter, (req, res) => {
  try {
    // Validate API key
    if (!validateApiKey(req)) {
      console.warn(`[SECURITY] Unauthorized manifest request - Missing or invalid API key from ${req.ip}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      });
    }

    // Get folder path from query parameter
    const folderPath = req.query.folder || '';

    if (!folderPath) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Folder path is required (use ?folder=path)'
      });
    }

    // Validate folder path
    if (!validateFolderPath(folderPath)) {
      console.warn(`[SECURITY] Forbidden manifest request - Path not in whitelist: ${folderPath} from ${req.ip}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access to this folder is not allowed'
      });
    }

    // Construct manifest file path
    const manifestPath = path.join(process.cwd(), folderPath, 'manifest.json');
    
    // Verify the manifest file exists and is readable
    if (!fileExists(manifestPath)) {
      console.warn(`[SECURITY] Manifest not found: ${manifestPath}`);
      return res.status(404).json({
        error: 'Not Found',
        message: 'Manifest file not found for this folder'
      });
    }

    // Read and parse manifest
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Log successful request
    console.log(`[SUCCESS] Manifest served for folder: ${folderPath}`);

    // Send manifest with appropriate headers
    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json(manifest);

  } catch (error) {
    console.error(`[ERROR] Manifest request failed:`, error.message);

    // Don't expose internal error details to client
    if (error instanceof SyntaxError) {
      return res.status(500).json({
        error: 'Server Error',
        message: 'Invalid manifest file format'
      });
    }

    res.status(500).json({
      error: 'Server Error',
      message: 'An error occurred while processing your request'
    });
  }
});

/**
 * List allowed folders (for reference)
 * Requires API key
 */
app.get('/api/folders', (req, res) => {
  // Validate API key
  if (!validateApiKey(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }

  res.json({
    folders: ALLOWED_FOLDERS,
    message: 'List of accessible folders'
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found'
  });
});

/**
 * Error Handler
 */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  
  res.status(err.status || 500).json({
    error: err.error || 'Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// === SERVER START ===

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   File Explorer Secure API Server      ║
╠════════════════════════════════════════╣
║ Port: ${PORT}                              ║
║ Environment: ${NODE_ENV}                      ║
║ CORS Origins: Multiple                 ║
║ Rate Limit: 100 req/15min per IP       ║
╚════════════════════════════════════════╝
  `);
  console.log(`\nAPI Documentation:`);
  console.log(`  GET /api/health - Health check`);
  console.log(`  GET /api/manifest?folder=path - Get manifest (requires X-API-Key header)`);
  console.log(`  GET /api/folders - List allowed folders (requires X-API-Key header)\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
