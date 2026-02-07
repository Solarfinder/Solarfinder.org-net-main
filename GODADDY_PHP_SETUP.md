# GoDaddy Shared Hosting Setup Guide - PHP API

## Overview

This guide will help you set up the secure File Explorer API on GoDaddy shared hosting using PHP. No additional software installation needed!

## Files You'll Need

- `api.php` - The PHP API server
- `config.php` - Configuration file with API key
- `file-explorer.html` - The web interface
- `generate-manifest.js` - Manifest generator (run locally)

## Step 1: Generate Manifest Locally

First, generate the manifest.json file for your folders on your local computer:

```bash
# On your computer (requires Node.js)
node generate-manifest.js ./pub_ab
```

This creates: `pub_ab/manifest.json`

## Step 2: Upload Files to GoDaddy

Using FTP or File Manager in GoDaddy cPanel:

```
/public_html/
├── api.php                    ← Upload this
├── config.php                 ← Upload this  
├── file-explorer.html         ← Upload this
├── style.css                  ← Existing
├── index.html                 ← Existing
│
├── pub_ab/
│   ├── manifest.json          ← Upload this (generated locally)
│   └── Expeditionary_Force/
│       └── *.mp3              ← Your audio files
│
└── assets/
    └── ...
```

## Step 3: Configure API Key

1. Upload `config.php` to your public_html root
2. Edit `config.php` via FTP or cPanel File Manager
3. Change the API_KEY to something secure:

```php
// Generate a secure key with this command (run on your computer):
// php -r "echo bin2hex(random_bytes(32));"

define('API_KEY', 'your-generated-secure-key-here');
```

Or via command line (if you have SSH access):

```bash
ssh youruser@yourdomain.com
php -r "echo bin2hex(random_bytes(32));"
```

## Step 4: Configure File Explorer

Edit `file-explorer.html` and update the API URL:

Find this section (around line 580):
```javascript
// API Configuration
this.apiUrl = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : ''; // Use the current domain
```

Change to:
```javascript
// API Configuration
this.apiUrl = window.location.origin; // Points to your GoDaddy domain
this.apiKey = 'your-api-key-here'; // Same as config.php
```

Or set it in browser console:
```javascript
localStorage.setItem('fileExplorerApiKey', 'your-api-key-here');
```

## Step 5: Test the Setup

1. Open your browser and navigate to:
   ```
   https://yourdomain.com/api.php?action=health
   ```

   You should see:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "environment": "production"
   }
   ```

2. Open File Explorer:
   ```
   https://yourdomain.com/file-explorer.html
   ```

3. Switch to "Load from URL" tab
4. Enter: `pub_ab`
5. Click "Load Folder"

## API Endpoints

### Health Check (No Auth)
```
GET /api.php?action=health
```

### Get Manifest (Requires API Key)
```
GET /api.php?action=manifest&folder=pub_ab
Headers:
  X-API-Key: your-api-key
```

### List Folders (Requires API Key)
```
GET /api.php?action=folders
Headers:
  X-API-Key: your-api-key
```

## Security

### API Key Management

**Generate a new key:**
```bash
# On any computer with PHP installed:
php -r "echo bin2hex(random_bytes(32));"

# Or on Unix/Linux:
openssl rand -hex 32

# Or just use an online generator:
# https://www.random.org/strings/?num=1&len=64&digits=on&loweralpha=on&upperalpha=off
```

### Update Key Regularly

```php
// In config.php - change this approximately every 6 months
define('API_KEY', 'new-generated-key-here');
```

### Remove Old config.php

Once uploaded and working, remove the default API_KEY comments:

```php
<?php
// Never commit config.php to git!
define('API_KEY', 'your-actual-secure-key');
define('ENV_MODE', 'production');
?>
```

## Troubleshooting

### "API Error: 401 Unauthorized"

- Check that `config.php` is in the same directory as `api.php`
- Verify the API key in both `config.php` and `file-explorer.html` match
- Check browser console for detailed error

### "API Error: 403 Forbidden"

- The folder path isn't in the whitelist
- Edit `api.php` and add your folder to `$ALLOWED_FOLDERS`

### "manifest.json not found"

- Run `node generate-manifest.js` locally
- Make sure `manifest.json` is uploaded to the folder
- Check file permissions (should be readable)

### "502 Bad Gateway" or "500 Error"

- Check if `config.php` exists and is valid PHP
- Verify no syntax errors: test file via browser
- Check GoDaddy's error logs in cPanel

**To view errors:**
1. Go to GoDaddy cPanel
2. Look for "Error Log" or "Raw Access Log"
3. Check PHP error messages

### Rate Limiting

The API limits requests to prevent abuse:
- **10 requests per 15 minutes per IP address**

If you hit the limit:
- Wait 15 minutes, or
- Edit `api.php` and increase `RATE_LIMIT_MAX_REQUESTS`

## Advanced Configuration

### Whitelist Specific Folders Only

Edit `api.php` around line 23:

```php
$ALLOWED_FOLDERS = array(
    'pub_ab',
    'pub_ab/Expeditionary_Force',
    'assets/documents'  // Add your folders here
);
```

### Adjust Rate Limiting

Edit `api.php` around line 30:

```php
define('RATE_LIMIT_MAX_REQUESTS', 10);      // Increase this
define('RATE_LIMIT_WINDOW_MINUTES', 15);    // Or change this
```

### Enable Logging

GoDaddy saves logs automatically in:
- `public_html/logs/api.log` (created automatically)

View via cPanel File Manager or FTP

## Testing with API Tools

### Using curl (command line)

```bash
# Health check
curl https://yourdomain.com/api.php?action=health

# Get manifest (requires API key)
curl -H "X-API-Key: your-api-key" \
  "https://yourdomain.com/api.php?action=manifest&folder=pub_ab"
```

### Using Postman (GUI Tool)

1. Install Postman: https://www.postman.com/downloads/
2. Create new GET request
3. URL: `https://yourdomain.com/api.php?action=manifest&folder=pub_ab`
4. Headers: Add `X-API-Key` with your key
5. Send

## Important Notes

1. **Never commit `config.php` to git** - it contains your API key!
2. **Keep API key secret** - treat like a password
3. **Use HTTPS** - GoDaddy provides free SSL certificates
4. **Monitor logs** - check for unauthorized access attempts
5. **Rotate key regularly** - every 6 months recommended

## GoDaddy-Specific Tips

### Enable PHP Version

1. Go to GoDaddy cPanel
2. Navigate to "Select PHP Version"
3. Ensure PHP 7.4 or higher is selected
4. Click "Set as default"

### Create logs Directory

If you want persistent logs:

1. Via cPanel File Manager:
   - Navigate to public_html
   - Create new folder: `logs`
   - Set permissions to 755

2. Or via FTP:
   - Create folder `public_html/logs/`
   - Set permissions to 755

### SSL/TLS Certificate

Your domain likely already has a free SSL certificate from GoDaddy:

1. Go to cPanel
2. Look for "SSL/TLS Status"
3. Ensure it's "Installed"
4. Use `https://` in all URLs

## Next Steps

1. Upload files to GoDaddy
2. Configure `config.php` with secure API key
3. Update `file-explorer.html` with your domain
4. Test the health endpoint
5. Open File Explorer and load your folders

## Support Resources

- GoDaddy Support: https://www.godaddy.com/help
- PHP Documentation: https://www.php.net/manual/
- Check error logs in cPanel

---

**Setup Time:** ~15 minutes  
**Skills Required:** Basic FTP/File Manager, text editing  
**Cost:** Free (already included with hosting)
