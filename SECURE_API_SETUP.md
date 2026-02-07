# Secure File Explorer API Setup Guide

## Overview

The File Explorer now includes an optional secure backend API for authenticated access to manifest files. This prevents unauthorized users from browsing your folder structures.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- **express** - Web framework
- **cors** - Cross-Origin Resource Sharing
- **dotenv** - Environment configuration
- **express-rate-limit** - Rate limiting protection

### 2. Configure Environment

Copy the example file and create your configuration:

```bash
cp .env.example .env
```

Edit `.env` and set these values:

```env
PORT=3000
API_KEY=your-very-secure-random-key-here
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

**Generate a secure API key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will start at `http://localhost:3000`

## How to Use

### Frontend Configuration

The file explorer automatically detects if you're running locally and uses the API:

```javascript
// In file-explorer.html, the constructor sets:
this.apiUrl = 'http://localhost:3000'; // Auto-configured for localhost
this.apiKey = localStorage.getItem('fileExplorerApiKey') || '';
```

To set the API key in the browser console:
```javascript
localStorage.setItem('fileExplorerApiKey', 'your-api-key');
```

Or modify the constructor if deploying to production.

### API Endpoints

#### Health Check
```
GET /api/health
```

Returns server status (no authentication required)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-07T10:30:45.123Z",
  "environment": "development"
}
```

#### Get Manifest (Authenticated)
```
GET /api/manifest?folder=path/to/folder
Headers:
  X-API-Key: your-api-key
  Content-Type: application/json
```

**Example Requests:**

```bash
# Get manifest for pub_ab folder
curl -H "X-API-Key: your-api-key" \
  "http://localhost:3000/api/manifest?folder=pub_ab"

# Get manifest for Expeditionary_Force subfolder
curl -H "X-API-Key: your-api-key" \
  "http://localhost:3000/api/manifest?folder=pub_ab/Expeditionary_Force"
```

**Response:**
```json
{
  "name": "pub_ab",
  "description": "File listing for pub_ab",
  "generated": "2024-02-07T10:30:45.123Z",
  "files": [...],
  "folders": [...]
}
```

#### List Allowed Folders (Authenticated)
```
GET /api/folders
Headers:
  X-API-Key: your-api-key
```

Returns list of folders accessible to this API key.

## Security Features

### 1. API Key Authentication
- All manifest requests require a valid `X-API-Key` header
- Key is validated on every request
- Configure different keys for different environments

### 2. Folder Whitelisting
Only folders in the `ALLOWED_FOLDERS` list are accessible.

**Modify in server.js:**
```javascript
const ALLOWED_FOLDERS = [
  'pub_ab',
  'pub_ab/Expeditionary_Force',
  'assets',
  'assets/documents'
];
```

### 3. Path Traversal Prevention
- Blocks `..` (parent directory traversal)
- Validates paths are normalized
- Prevents access outside whitelisted folders

### 4. Rate Limiting
- General limit: 100 requests per IP per 15 minutes
- Manifest endpoint: 10 requests per IP per 15 minutes
- Prevents brute force attacks

### 5. CORS Protection
- Only allows requests from configured origins
- Prevents cross-site requests from unauthorized domains

**Configure in .env:**
```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 6. Input Validation
- Validates API key format
- Validates folder paths
- Prevents JSON injection attacks

### 7. Logging
- All requests are logged with timestamp and IP
- Security events (unauthorized access) are highlighted

## Deployment

### Production Checklist

- [ ] Change `API_KEY` to a secure random value
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for your domain
- [ ] Use HTTPS only (consider reverse proxy)
- [ ] Set up SSL certificates
- [ ] Enable firewall rules
- [ ] Monitor logs for suspicious activity
- [ ] Use PM2 or similar for process management

### PM2 Setup

```bash
npm install -g pm2
pm2 start server.js --name "file-explorer-api"
pm2 save
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t file-explorer-api .
docker run -p 3000:3000 --env-file .env file-explorer-api
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring & Logs

Check logs for security events:

```bash
# View API key failures
npm start | grep "Unauthorized\|Invalid API key"

# View forbidden access attempts
npm start | grep "Forbidden\|Path not in whitelist"

# View all requests
npm start 2>&1 | tee api.log
```

## Troubleshooting

### "API key not configured"
- Set the API key in localStorage: `localStorage.setItem('fileExplorerApiKey', 'your-key')`
- Or modify the constructor in `file-explorer.html`

### "Access to this folder is not allowed"
- Check that the folder is in `ALLOWED_FOLDERS` in `server.js`
- Verify the folder path spelling

### "CORS error: Origin not allowed"
- Add your domain to `ALLOWED_ORIGINS` in `.env`
- Example: `ALLOWED_ORIGINS=https://yourdomain.com`

### "Too many requests from this IP"
- Rate limit exceeded (100 req/15min)
- Wait 15 minutes or restart server
- Adjust limits in `server.js` if needed

### "manifest.json not found"
- Ensure manifest.json exists in the folder
- Use `generate-manifest.js` to create it
- Check file permissions (must be readable)

## API Key Rotation

To change your API key without downtime:

1. Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Update `.env` with new key
3. Restart server: `pm2 restart file-explorer-api`
4. Update clients with new key

## Support

For issues or questions:
1. Check logs: `npm start`
2. Verify configuration in `.env`
3. Test API endpoint: curl with `-v` flag for details
4. Check browser console for client-side errors

## Security Considerations

- Never commit `.env` to git
- Rotate API keys regularly
- Use HTTPS in production
- Monitor logs for suspicious activity
- Keep dependencies updated: `npm audit`
- Use firewall rules to restrict access
- Consider API key versioning for different clients

---

**Version:** 1.0.0  
**Last Updated:** February 2024
