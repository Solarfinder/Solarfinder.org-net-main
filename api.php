<?php
/**
 * Secure File Explorer API - PHP Version
 * Compatible with GoDaddy shared hosting
 * 
 * Place this file at: /api.php (or /api/index.php)
 * Configure API key in: config.php or set environment variable
 */

// === CONFIGURATION ===

// Get API key from config file or environment
if (file_exists('config.php')) {
    require_once 'config.php';
} else {
    define('API_KEY', getenv('FILE_EXPLORER_API_KEY') ?: 'your-secure-api-key-change-me');
    define('ALLOWED_ORIGINS', getenv('ALLOWED_ORIGINS') ?: 'http://localhost,file://');
    define('ENV_MODE', getenv('ENV_MODE') ?: 'production');
}

// Whitelist of allowed folders
$ALLOWED_FOLDERS = array(
    'pub_ab',
    'pub_ab/Expeditionary_Force',
    'assets',
    'assets/documents'
);

// Rate limiting configuration
define('RATE_LIMIT_ENABLED', true);
define('RATE_LIMIT_FILE', sys_get_temp_dir() . '/file-explorer-rate-limit.json');
define('RATE_LIMIT_MAX_REQUESTS', 10);
define('RATE_LIMIT_WINDOW_MINUTES', 15);

// === HELPER FUNCTIONS ===

/**
 * Send JSON response with appropriate headers
 */
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    echo json_encode($data);
    exit;
}

/**
 * Log events (security and errors)
 */
function logEvent($level, $message) {
    $logDir = dirname(__FILE__) . '/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/api.log';
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    $logMessage = "[$timestamp] [$level] [$ip] $message\n";
    
    @file_put_contents($logFile, $logMessage, FILE_APPEND);
}

/**
 * Validate API key
 */
function validateApiKey() {
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    
    if (!$apiKey || $apiKey !== API_KEY) {
        logEvent('SECURITY', 'Unauthorized access attempt - Invalid API key');
        sendJsonResponse(array(
            'error' => 'Unauthorized',
            'message' => 'Invalid or missing API key'
        ), 401);
    }
}

/**
 * Check rate limiting
 */
function checkRateLimit() {
    if (!RATE_LIMIT_ENABLED) {
        return true;
    }
    
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    $now = time();
    $windowStart = $now - (RATE_LIMIT_WINDOW_MINUTES * 60);
    $limits = array();
    
    // Read existing rate limits
    if (file_exists(RATE_LIMIT_FILE)) {
        $limits = json_decode(file_get_contents(RATE_LIMIT_FILE), true) ?: array();
    }
    
    // Clean old entries
    foreach ($limits as $key => $data) {
        if ($data['timestamp'] < $windowStart) {
            unset($limits[$key]);
        }
    }
    
    // Check current IP
    if (!isset($limits[$ip])) {
        $limits[$ip] = array('count' => 0, 'timestamp' => $now);
    }
    
    // Increment counter
    $limits[$ip]['count']++;
    
    // Save updated limits
    @file_put_contents(RATE_LIMIT_FILE, json_encode($limits));
    
    // Check if limit exceeded
    if ($limits[$ip]['count'] > RATE_LIMIT_MAX_REQUESTS) {
        logEvent('SECURITY', "Rate limit exceeded for IP: $ip");
        sendJsonResponse(array(
            'error' => 'Too Many Requests',
            'message' => 'Rate limit exceeded. Please try again later.'
        ), 429);
    }
    
    return true;
}

/**
 * Validate folder path - prevent directory traversal
 */
function validateFolderPath($folderPath, $allowedFolders) {
    // Check for path traversal attempts
    if (strpos($folderPath, '..') !== false || 
        strpos($folderPath, '//') !== false || 
        strpos($folderPath, '\\') !== false ||
        substr($folderPath, 0, 1) === '/') {
        return false;
    }
    
    // Normalize path
    $folderPath = str_replace('\\', '/', $folderPath);
    
    // Check if in whitelist
    foreach ($allowedFolders as $allowed) {
        if ($folderPath === $allowed || 
            strpos($folderPath, $allowed . '/') === 0) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if file exists and is readable
 */
function fileExists($filePath) {
    return is_readable($filePath) && file_exists($filePath);
}

/**
 * Get MIME type
 */
function getMimeType($filePath) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    
    $mimeTypes = array(
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'flac' => 'audio/flac',
        'm4a' => 'audio/mp4',
        'pdf' => 'application/pdf',
        'txt' => 'text/plain',
        'md' => 'text/markdown',
        'html' => 'text/html',
        'json' => 'application/json',
        'zip' => 'application/zip',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml'
    );
    
    return isset($mimeTypes[$ext]) ? $mimeTypes[$ext] : 'application/octet-stream';
}

/**
 * Recursively traverse directory and build structure
 */
function traverseDirectory($dirPath, $baseWebPath = '') {
    $items = array(
        'files' => array(),
        'folders' => array()
    );
    
    if (!is_dir($dirPath) || !is_readable($dirPath)) {
        return $items;
    }
    
    try {
        $entries = @scandir($dirPath);
        if ($entries === false) {
            return $items;
        }
        
        // Sort entries
        $files = array();
        $folders = array();
        
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..' || $entry === 'manifest.json') {
                continue;
            }
            
            $fullPath = $dirPath . '/' . $entry;
            
            if (is_dir($fullPath)) {
                $folders[] = $entry;
            } elseif (is_file($fullPath)) {
                $files[] = $entry;
            }
        }
        
        // Sort alphabetically
        sort($files);
        sort($folders);
        
        // Process folders
        foreach ($folders as $folderName) {
            $fullPath = $dirPath . '/' . $folderName;
            $webPath = $baseWebPath ? $baseWebPath . '/' . $folderName : $folderName;
            
            $folderData = array(
                'name' => $folderName,
                'files' => array(),
                'folders' => array()
            );
            
            $nested = traverseDirectory($fullPath, '/pub_ab/' . $webPath);
            $folderData['files'] = $nested['files'];
            $folderData['folders'] = $nested['folders'];
            
            $items['folders'][] = $folderData;
        }
        
        // Process files
        foreach ($files as $fileName) {
            $fullPath = $dirPath . '/' . $fileName;
            $webPath = $baseWebPath ? $baseWebPath . '/' . $fileName : $fileName;
            $filePath = '/pub_ab/' . $webPath;
            $fileSize = @filesize($fullPath);
            $fileType = getMimeType($fullPath);
            
            $items['files'][] = array(
                'name' => $fileName,
                'path' => $filePath,
                'size' => $fileSize ?: 0,
                'type' => $fileType
            );
        }
        
    } catch (Exception $e) {
        logEvent('ERROR', "Error traversing directory: " . $e->getMessage());
    }
    
    return $items;
}

// === CORS HANDLER ===

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    header('Access-Control-Max-Age: 3600');
    http_response_code(200);
    exit;
}

// === API ENDPOINTS ===

$action = $_GET['action'] ?? '';
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Health check endpoint (no authentication required)
if ($action === 'health' || strpos($requestUri, '/health') !== false) {
    sendJsonResponse(array(
        'status' => 'ok',
        'timestamp' => date('c'),
        'environment' => ENV_MODE
    ));
}

// Manifest endpoint (requires authentication)
if ($action === 'manifest' || strpos($requestUri, '/manifest') !== false) {
    // Check rate limit first
    checkRateLimit();
    
    // Validate API key
    validateApiKey();
    
    // Get folder parameter
    $folder = $_GET['folder'] ?? '';
    
    if (empty($folder)) {
        sendJsonResponse(array(
            'error' => 'Bad Request',
            'message' => 'Folder parameter is required (use ?folder=path)'
        ), 400);
    }
    
    // Validate folder path
    if (!validateFolderPath($folder, $ALLOWED_FOLDERS)) {
        logEvent('SECURITY', "Forbidden access attempt to folder: $folder");
        sendJsonResponse(array(
            'error' => 'Forbidden',
            'message' => 'Access to this folder is not allowed'
        ), 403);
    }
    
    // Get manifest or generate from directory
    $manifestPath = $folder . '/manifest.json';
    $dirPath = $folder;
    
    // Try to load manifest.json first
    if (fileExists($manifestPath)) {
        $manifestContent = @file_get_contents($manifestPath);
        if ($manifestContent) {
            $manifest = json_decode($manifestContent, true);
            if ($manifest) {
                header('Content-Type: application/json');
                header('Cache-Control: public, max-age=300');
                logEvent('INFO', "Manifest served from file: $manifestPath");
                echo json_encode($manifest);
                exit;
            }
        }
    }
    
    // Generate manifest from directory
    if (is_dir($dirPath) && is_readable($dirPath)) {
        $structure = traverseDirectory($dirPath);
        
        $manifest = array(
            'name' => basename($dirPath),
            'description' => 'File listing for ' . basename($dirPath),
            'generated' => date('c'),
            'files' => $structure['files'],
            'folders' => $structure['folders']
        );
        
        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=300');
        logEvent('INFO', "Manifest generated for directory: $dirPath");
        echo json_encode($manifest);
        exit;
    }
    
    logEvent('ERROR', "Manifest not found for folder: $folder");
    sendJsonResponse(array(
        'error' => 'Not Found',
        'message' => 'Manifest file or folder not found'
    ), 404);
}

// Folders list endpoint (requires authentication)
if ($action === 'folders' || strpos($requestUri, '/folders') !== false) {
    validateApiKey();
    
    sendJsonResponse(array(
        'folders' => $ALLOWED_FOLDERS,
        'message' => 'List of accessible folders'
    ));
}

// Default: show API documentation
sendJsonResponse(array(
    'error' => 'Not Found',
    'message' => 'API endpoint not found',
    'documentation' => array(
        'health' => 'GET /api.php?action=health (no auth required)',
        'manifest' => 'GET /api.php?action=manifest&folder=path (requires X-API-Key header)',
        'folders' => 'GET /api.php?action=folders (requires X-API-Key header)'
    )
), 404);

?>
