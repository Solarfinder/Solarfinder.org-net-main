#!/usr/bin/env node

/**
 * Generate manifest.json for directories with optional ffprobe audio metadata
 * Usage: node generate-manifest.js [folderPath] [--ffprobe]
 * Example: node generate-manifest.js ./pub_ab --ffprobe
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ManifestGenerator {
  constructor(basePath = './pub_ab', options = {}) {
    this.basePath = basePath;
    this.baseUrl = `/pub_ab`; // Relative URL for web access
    this.useFfprobe = options.ffprobe || false;
    this.ffprobePath = 'ffprobe'; // Path to ffprobe executable
  }

  /**
   * Check if ffprobe is available
   */
  checkFfprobeAvailable() {
    try {
      execSync(`${this.ffprobePath} -version`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract audio metadata using ffprobe
   */
  getAudioMetadata(filePath) {
    if (!this.useFfprobe || !this.checkFfprobeAvailable()) {
      return null;
    }

    try {
      const command = `${this.ffprobePath} -v quiet -print_format json -show_format -show_streams "${filePath}"`;
      const output = execSync(command, { encoding: 'utf-8' });
      const data = JSON.parse(output);

      const metadata = {};

      // Get duration from format
      if (data.format?.duration) {
        metadata.duration = parseFloat(data.format.duration);
      }

      // Get bitrate from format
      if (data.format?.bit_rate) {
        metadata.bitrate = parseInt(data.format.bit_rate);
      }

      // Extract audio stream information
      const audioStream = data.streams?.find(s => s.codec_type === 'audio');
      if (audioStream) {
        if (audioStream.sample_rate) {
          metadata.sampleRate = parseInt(audioStream.sample_rate);
        }
        if (audioStream.channels) {
          metadata.channels = parseInt(audioStream.channels);
        } else if (audioStream.channel_layout) {
          metadata.channelLayout = audioStream.channel_layout;
        }
        if (audioStream.codec_name) {
          metadata.codec = audioStream.codec_name;
        }
        if (audioStream.bit_rate && !metadata.bitrate) {
          metadata.bitrate = parseInt(audioStream.bit_rate);
        }
      }

      return Object.keys(metadata).length > 0 ? metadata : null;
    } catch (error) {
      console.warn(`⚠️  FFprobe failed for ${path.basename(filePath)}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get file size in bytes
   */
  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      console.error(`Error getting size of ${filePath}:`, error.message);
      return 0;
    }
  }

  /**
   * Get MIME type based on file extension
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.json': 'application/json',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Recursively traverse directory and build structure
   */
  traverseDirectory(dirPath, baseWebPath = '') {
    const items = {
      files: [],
      folders: []
    };

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      // Sort entries: folders first, then files
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      entries.forEach((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const webPath = baseWebPath ? `${baseWebPath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Process folder
          const folderData = {
            name: entry.name,
            ...this.traverseDirectory(fullPath, `${this.baseUrl}/${webPath}`)
          };
          items.folders.push(folderData);
        } else if (entry.isFile()) {
          // Process file
          const filePath = `${this.baseUrl}/${webPath}`;
          const fullPathFile = path.join(dirPath, entry.name);
          const fileSize = this.getFileSize(fullPathFile);
          const fileType = this.getMimeType(fullPathFile);

          const fileObj = {
            name: entry.name,
            path: filePath,
            size: fileSize,
            type: fileType
          };

          // Extract audio metadata if enabled and it's an audio file
          if (this.useFfprobe && fileType.startsWith('audio/')) {
            const audioMeta = this.getAudioMetadata(fullPathFile);
            if (audioMeta) {
              fileObj.audio = audioMeta;
            }
          }

          items.files.push(fileObj);
        }
      });
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error.message);
    }

    return items;
  }

  /**
   * Generate manifest for a specific folder
   */
  generateManifest(folderPath = null) {
    const targetPath = folderPath || this.basePath;

    if (!fs.existsSync(targetPath)) {
      console.error(`Error: Path does not exist: ${targetPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      console.error(`Error: Path is not a directory: ${targetPath}`);
      process.exit(1);
    }

    console.log(`📁 Generating manifest for: ${targetPath}`);

    const structure = this.traverseDirectory(targetPath);
    
    const manifest = {
      name: path.basename(targetPath),
      description: `File listing for ${path.basename(targetPath)}`,
      generated: new Date().toISOString(),
      ...structure
    };

    return manifest;
  }

  /**
   * Write manifest to file
   */
  writeManifest(folderPath = null, outputFileName = 'manifest.json') {
    const targetPath = folderPath || this.basePath;
    const manifest = this.generateManifest(targetPath);
    const outputPath = path.join(targetPath, outputFileName);

    try {
      fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log(`✅ Manifest created: ${outputPath}`);
      console.log(`📊 Summary:`);
      console.log(`   Files: ${this.countFiles(manifest)}`);
      console.log(`   Folders: ${this.countFolders(manifest)}`);
      console.log(`   Total size: ${this.formatBytes(this.getTotalSize(manifest))}`);
      if (this.useFfprobe) {
        console.log(`   Audio metadata: ✓ Extracted with ffprobe`);
      }
      return outputPath;
    } catch (error) {
      console.error(`Error writing manifest to ${outputPath}:`, error.message);
      process.exit(1);
    }
  }

  /**
   * Count total files recursively
   */
  countFiles(obj) {
    let count = (obj.files ? obj.files.length : 0);
    if (obj.folders) {
      obj.folders.forEach(folder => {
        count += this.countFiles(folder);
      });
    }
    return count;
  }

  /**
   * Count total folders recursively
   */
  countFolders(obj) {
    let count = 0;
    if (obj.folders) {
      count = obj.folders.length;
      obj.folders.forEach(folder => {
        count += this.countFolders(folder);
      });
    }
    return count;
  }

  /**
   * Get total size recursively
   */
  getTotalSize(obj) {
    let size = 0;
    if (obj.files) {
      obj.files.forEach(file => {
        size += file.size || 0;
      });
    }
    if (obj.folders) {
      obj.folders.forEach(folder => {
        size += this.getTotalSize(folder);
      });
    }
    return size;
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const folderPath = args[0] || './pub_ab';
  const useFFprobe = args.includes('--ffprobe');

  if (useFFprobe) {
    console.log('🎵 FFprobe mode enabled - extracting audio metadata...\n');
  }

  const generator = new ManifestGenerator(folderPath, { ffprobe: useFFprobe });
  
  if (useFFprobe && !generator.checkFfprobeAvailable()) {
    console.log('⚠️  FFprobe not found! Make sure ffmpeg is installed:');
    console.log('   MacOS: brew install ffmpeg');
    console.log('   Linux: apt install ffmpeg');
    console.log('   Windows: Download from https://ffmpeg.org/download.html\n');
    console.log('Continuing without audio metadata extraction...\n');
    generator.useFfprobe = false;
  }

  generator.writeManifest(folderPath);
}

module.exports = ManifestGenerator;
