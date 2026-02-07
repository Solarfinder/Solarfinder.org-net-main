<?php
/**
 * Web-Based Manifest Generator for GoDaddy
 * 
 * Usage:
 *   http://yourdomain.com/generate-manifest.php?folder=pub_ab&save=1&key=Y8955b7b6de5f77817ca7d7746338ef8fc5cb5c1fe1a95fbc2e7c17d88e3081fc
 * 
 * Parameters:
 *   - folder: The folder path to scan (relative to public_html)
 *   - save: 1 to save manifest.json to the folder, 0 to output JSON only (default: 0)
 *   - key: API key for security (must match config.php API_KEY)
 * 
 * Returns:
 *   - JSON manifest structure or success message if saved
 */

// Security: Require API key
define('API_KEY_REQUIRED', true);

// Load config if available
$configPath = __DIR__ . '/config.php';
if (file_exists($configPath)) {
    require_once $configPath;
} else {
    define('API_KEY', 'demo-key'); // Fallback for testing
}

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verify API key
if (API_KEY_REQUIRED) {
    $providedKey = $_GET['key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? null;
    if ($providedKey !== API_KEY) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or missing API key']);
        exit;
    }
}

// Get parameters
$folder = $_GET['folder'] ?? '';
$save = (bool)($_GET['save'] ?? 0);

// Validate folder parameter
if (empty($folder)) {
    http_response_code(400);
    echo json_encode(['error' => 'Folder parameter required']);
    exit;
}

// Security: Prevent path traversal
$folder = str_replace(['..', '\\'], ['', '/'], $folder);
$folder = trim($folder, '/');

// Construct full path
$fullPath = rtrim(__DIR__, '/') . '/' . $folder;

// Verify path is within public_html
$realPath = realpath($fullPath);
$realBase = realpath(__DIR__);

if (!$realPath || strpos($realPath, $realBase) !== 0) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied: Path is outside allowed directory']);
    exit;
}

// Check if folder exists
if (!is_dir($realPath)) {
    http_response_code(404);
    echo json_encode(['error' => "Folder not found: $folder"]);
    exit;
}

/**
 * Recursively traverse directory and build manifest structure
 */
function traverseDirectory($path, $relativePath = '') {
    $items = [];
    
    try {
        $entries = scandir($path);
        if ($entries === false) {
            return $items;
        }
        
        // Sort entries
        sort($entries);
        
        foreach ($entries as $entry) {
            // Skip hidden files and special directories
            if (in_array($entry, ['.', '..', '.git', '.gitignore', '.env', 'config.php'])) {
                continue;
            }
            
            $fullPath = $path . '/' . $entry;
            $itemRelativePath = $relativePath ? $relativePath . '/' . $entry : $entry;
            
            if (is_dir($fullPath)) {
                // Directory
                $item = [
                    'name' => $entry,
                    'type' => 'folder',
                    'path' => $itemRelativePath,
                    'children' => traverseDirectory($fullPath, $itemRelativePath)
                ];
            } else if (is_file($fullPath)) {
                // File
                $fileSize = filesize($fullPath);
                $mimeType = getMimeType($fullPath);
                $item = [
                    'name' => $entry,
                    'type' => 'file',
                    'path' => $itemRelativePath,
                    'size' => $fileSize,
                    'mimeType' => $mimeType
                ];
                
                // Extract audio metadata if it's an audio file
                if (strpos($mimeType, 'audio/') === 0) {
                    $audioMetadata = getAudioMetadata($fullPath);
                    if ($audioMetadata) {
                        $item['audio'] = $audioMetadata;
                    }
                }
            } else {
                continue;
            }
            
            $items[] = $item;
        }
    } catch (Exception $e) {
        // Handle permission errors gracefully
    }
    
    return $items;
}

/**
 * Get MIME type for file
 */
function getMimeType($filePath) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    
    $mimeTypes = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml',
        'pdf' => 'application/pdf', 'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt' => 'text/plain', 'html' => 'text/html', 'css' => 'text/css',
        'js' => 'application/javascript', 'json' => 'application/json',
        'xml' => 'application/xml', 'zip' => 'application/zip',
        'mp3' => 'audio/mpeg', 'mp4' => 'video/mp4', 'avi' => 'video/x-msvideo'
    ];
    
    return $mimeTypes[$ext] ?? 'application/octet-stream';
}

/**
 * Extract audio metadata using ffprobe
 * Returns array with duration, bitrate, sample rate, channels, codec, or null if ffprobe unavailable
 */
function getAudioMetadata($filePath) {
    // Check if ffprobe is available
    $ffprobePath = shell_exec('which ffprobe 2>/dev/null') ?: 'ffprobe';
    $testProbe = @shell_exec("$ffprobePath -version 2>&1");
    
    if (!$testProbe || strpos($testProbe, 'ffprobe') === false) {
        // ffprobe not available
        return null;
    }
    
    try {
        // Use ffprobe to extract audio information in JSON format
        $command = sprintf(
            '%s -v quiet -print_format json -show_format -show_streams %s',
            escapeshellarg($ffprobePath),
            escapeshellarg($filePath)
        );
        
        $output = @shell_exec($command);
        if (!$output) {
            return null;
        }
        
        $data = json_decode($output, true);
        if (!$data) {
            return null;
        }
        
        $metadata = [];
        
        // Get duration from format
        if (isset($data['format']['duration'])) {
            $metadata['duration'] = (float)$data['format']['duration'];
        }
        
        // Get bitrate from format (prefer stream bitrate)
        if (isset($data['format']['bit_rate'])) {
            $metadata['bitrate'] = (int)$data['format']['bit_rate'];
        }
        
        // Extract stream information (audio)
        if (isset($data['streams']) && is_array($data['streams'])) {
            foreach ($data['streams'] as $stream) {
                if ($stream['codec_type'] === 'audio') {
                    // Sample rate
                    if (isset($stream['sample_rate'])) {
                        $metadata['sampleRate'] = (int)$stream['sample_rate'];
                    }
                    
                    // Channels
                    if (isset($stream['channels'])) {
                        $metadata['channels'] = (int)$stream['channels'];
                    } elseif (isset($stream['channel_layout'])) {
                        $metadata['channelLayout'] = $stream['channel_layout'];
                    }
                    
                    // Codec name
                    if (isset($stream['codec_name'])) {
                        $metadata['codec'] = $stream['codec_name'];
                    }
                    
                    // Stream bitrate (more accurate)
                    if (isset($stream['bit_rate']) && !isset($metadata['bitrate'])) {
                        $metadata['bitrate'] = (int)$stream['bit_rate'];
                    }
                    
                    // Only process first audio stream
                    break;
                }
            }
        }
        
        return !empty($metadata) ? $metadata : null;
    } catch (Exception $e) {
        return null;
    }
}

// Generate manifest structure
$manifest = [
    'version' => '1.0',
    'generatedAt' => date('c'),
    'folder' => $folder,
    'children' => traverseDirectory($realPath, '')
];

// If save is requested, write manifest.json to the folder
if ($save) {
    $manifestPath = $realPath . '/manifest.json';
    
    // Check if we can write to the directory
    if (!is_writable($realPath)) {
        http_response_code(403);
        echo json_encode(['error' => "Directory is not writable: $folder"]);
        exit;
    }
    
    // Write manifest.json with pretty formatting
    $json = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to encode manifest to JSON']);
        exit;
    }
    
    if (file_put_contents($manifestPath, $json) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write manifest.json to disk']);
        exit;
    }
    
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => "manifest.json saved to $folder/manifest.json",
        'path' => $manifestPath,
        'size' => filesize($manifestPath),
        'itemCount' => count($manifest['children'])
    ]);
} else {
    // Just return the manifest JSON
    http_response_code(200);
    echo json_encode($manifest);
}
?>
