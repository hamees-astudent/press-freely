# Press Freely - Deployment & Executable Guide

**Version:** 1.0  
**Last Updated:** January 14, 2026  
**Application:** End-to-End Encrypted Chat Application

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Building for Production](#building-for-production)
5. [Deployment Options](#deployment-options)
6. [Environment Configuration](#environment-configuration)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance & Monitoring](#maintenance--monitoring)

---

## System Requirements

### Minimum Requirements
- **OS:** Linux, macOS, or Windows 10/11
- **RAM:** 2GB minimum (4GB recommended)
- **Storage:** 500MB free space
- **Network:** Stable internet connection for WebRTC functionality

### Software Requirements
- **Node.js:** v18.0.0 or higher (LTS recommended)
- **npm:** v9.0.0 or higher
- **MongoDB:** v6.0 or higher
- **Git:** v2.30 or higher (for deployment)

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

---

## Prerequisites

### 1. Install Node.js and npm

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS (Homebrew):**
```bash
brew install node@18
```

**Windows:**
- Download installer from https://nodejs.org/
- Run installer and follow prompts

**Verify Installation:**
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show v9.x.x or higher
```

### 2. Install MongoDB

**Linux (Ubuntu/Debian):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Windows:**
- Download installer from https://www.mongodb.com/try/download/community
- Run installer with default settings
- Start MongoDB service from Services panel

**Verify Installation:**
```bash
mongosh --version  # Should show v6.x.x or higher
```

### 3. Clone Repository

```bash
cd /path/to/your/workspace
git clone https://github.com/hamees-astudent/press-freely
cd press-freely
```

---

## Local Development Setup

### Step 1: Install Dependencies

**Install Server Dependencies:**
```bash
cd server
npm install
```

**Expected packages:**
- express@5.2.1
- socket.io@4.8.1
- mongoose@9.0.2
- jsonwebtoken@9.0.3
- bcryptjs@2.4.3
- multer@2.0.2
- cors@2.8.5
- dotenv@16.4.7

**Install Client Dependencies:**
```bash
cd ../client
npm install
```

**Expected packages:**
- react@19.2.3
- socket.io-client@4.8.1
- simple-peer@9.11.1
- axios@1.13.2
- dompurify@3.3.1

### Step 2: Configure Environment Variables

**Create Server Environment File:**
```bash
cd ../server
cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/press-freely
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
EOF
```

**Create Client Environment File:**
```bash
cd ../client
cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
NODE_ENV=development
EOF
```

### Step 3: Initialize Database

**Start MongoDB:**
```bash
# Linux/macOS
sudo systemctl start mongod  # or: brew services start mongodb-community

# Windows
net start MongoDB
```

**Verify Database Connection:**
```bash
mongosh
> use press-freely
> db.stats()
> exit
```

### Step 4: Run Development Servers

**Terminal 1 - Start Backend:**
```bash
cd server
npm start
```

**Expected Output:**
```
Server is running on port 5000
MongoDB connected successfully
Socket.IO server initialized
```

**Terminal 2 - Start Frontend:**
```bash
cd client
npm start
```

**Expected Output:**
```
Compiled successfully!
You can now view press-freely in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

### Step 5: Verify Installation

1. **Open Browser:** Navigate to http://localhost:3000
2. **Register Account:** Create a test user account
3. **Test Features:**
   - Send text messages
   - Upload image (test compression)
   - Upload audio (test compression)
   - Initiate voice call (test WebRTC)
   - Test typing indicators
   - Export encryption keys
   - Check network quality indicator

---

## Building for Production

### Step 1: Build Client

```bash
cd client
npm run build
```

**Output:** Optimized production build in `client/build/` directory

**Verification:**
```bash
ls -lh build/  # Should show static/, index.html, etc.
du -sh build/  # Should be ~2-5MB
```

### Step 2: Configure Production Server

**Update Server .env:**
```bash
cd ../server
cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/press-freely-prod
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
EOF
```

### Step 3: Serve Static Files

**Option A: Express Serves React Build**

Add to `server/server.js` (after routes, before error handling):

```javascript
// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}
```

**Option B: Nginx Reverse Proxy (Recommended)**

See [Deployment Options](#deployment-options) for nginx configuration.

### Step 4: Production Test

```bash
cd server
NODE_ENV=production npm start
```

**Access:** http://localhost:5000

---

## Deployment Options

### Option 1: Traditional VPS (DigitalOcean, AWS EC2, Linode)

#### Prerequisites
- VPS with Ubuntu 20.04+ (2GB RAM minimum)
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

#### Step-by-Step Deployment

**1. Connect to Server:**
```bash
ssh root@your-server-ip
```

**2. Update System:**
```bash
apt update && apt upgrade -y
```

**3. Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
```

**4. Install MongoDB:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update
apt-get install -y mongodb-org
systemctl start mongod
systemctl enable mongod
```

**5. Install Nginx:**
```bash
apt-get install -y nginx
systemctl enable nginx
```

**6. Create Application User:**
```bash
adduser --system --group --no-create-home pressfreelyapp
```

**7. Clone and Setup Application:**
```bash
cd /opt
git clone <repository-url> press-freely
cd press-freely
chown -R pressfreelyapp:pressfreelyapp .
```

**8. Install Dependencies:**
```bash
cd server && sudo -u pressfreelyapp npm install --production
cd ../client && sudo -u pressfreelyapp npm install && npm run build
```

**9. Configure Environment:**
```bash
cd /opt/press-freely/server
sudo -u pressfreelyapp cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/press-freely
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
EOF
```

**10. Create Systemd Service:**
```bash
cat > /etc/systemd/system/press-freely.service << EOF
[Unit]
Description=Press Freely Chat Application
After=network.target mongod.service

[Service]
Type=simple
User=pressfreelyapp
WorkingDirectory=/opt/press-freely/server
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=press-freely
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

**11. Configure Nginx:**
```bash
cat > /etc/nginx/sites-available/press-freely << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (after Let's Encrypt setup)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve React Build
    root /opt/press-freely/client/build;
    index index.html;

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static Files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Caching for Static Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -s /etc/nginx/sites-available/press-freely /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
```

**12. Setup SSL with Let's Encrypt:**
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**13. Start Services:**
```bash
systemctl daemon-reload
systemctl start press-freely
systemctl enable press-freely
systemctl restart nginx
```

**14. Configure Firewall:**
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

**15. Verify Deployment:**
```bash
systemctl status press-freely
systemctl status nginx
systemctl status mongod
curl -I https://yourdomain.com
```

---

### Option 2: Docker Deployment

#### Dockerfile (Backend)

Create `server/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node uploads

# Use non-root user
USER node

EXPOSE 5000

CMD ["node", "server.js"]
```

#### Dockerfile (Frontend)

Create `client/Dockerfile`:

```dockerfile
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: press-freely-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: press-freely
    volumes:
      - mongo-data:/data/db
    networks:
      - press-freely-network

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: press-freely-backend
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      PORT: 5000
      MONGODB_URI: mongodb://mongodb:27017/press-freely
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      CORS_ORIGIN: ${CORS_ORIGIN}
    depends_on:
      - mongodb
    volumes:
      - ./server/uploads:/app/uploads
    networks:
      - press-freely-network

  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: press-freely-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      REACT_APP_API_URL: ${API_URL}
      REACT_APP_SOCKET_URL: ${SOCKET_URL}
    depends_on:
      - backend
    networks:
      - press-freely-network

volumes:
  mongo-data:
 Project report including:
o System architecture
o Network design
o Protocols used
o Answers to research questions
o Performance analysis
networks:
  press-freely-network:
    driver: bridge
```

#### Deploy with Docker

```bash
# Create .env file
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=https://yourdomain.com
API_URL=https://yourdomain.com/api
SOCKET_URL=https://yourdomain.com
EOF

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

### Option 3: Heroku Deployment

#### Prerequisites
- Heroku account
- Heroku CLI installed

#### Deployment Steps

**1. Install Heroku CLI:**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
heroku login
```

**2. Create Heroku Apps:**
```bash
heroku create press-freely-api
heroku create press-freely-app
```

**3. Add MongoDB (mLab):**
```bash
heroku addons:create mongolab:sandbox -a press-freely-api
```

**4. Configure Environment:**
```bash
heroku config:set JWT_SECRET=$(openssl rand -base64 32) -a press-freely-api
heroku config:set NODE_ENV=production -a press-freely-api
heroku config:set CORS_ORIGIN=https://press-freely-app.herokuapp.com -a press-freely-api
```

**5. Create Procfile:**
```bash
# server/Procfile
echo "web: node server.js" > server/Procfile

# client/Procfile
cat > client/Procfile << EOF
web: npm run build && npm install -g serve && serve -s build -l \$PORT
EOF
```

**6. Deploy Backend:**
```bash
cd server
git init
heroku git:remote -a press-freely-api
git add .
git commit -m "Deploy backend"
git push heroku master
```

**7. Deploy Frontend:**
```bash
cd ../client
git init
heroku git:remote -a press-freely-app
git add .
git commit -m "Deploy frontend"
git push heroku master
```

**8. Verify:**
```bash
heroku open -a press-freely-app
heroku logs --tail -a press-freely-api
```

---

### Option 4: AWS EC2 with Auto-Scaling

#### Architecture
- EC2 instances behind Application Load Balancer
- RDS for MongoDB (or MongoDB Atlas)
- S3 for file uploads
- CloudFront for CDN
- Auto-scaling group for high availability

#### Quick Setup Guide

**1. Launch EC2 Instance:**
- AMI: Ubuntu 20.04 LTS
- Instance Type: t3.medium (2 vCPU, 4GB RAM)
- Security Group: Allow 22, 80, 443, 5000

**2. Setup MongoDB Atlas:**
```bash
# Sign up at https://www.mongodb.com/cloud/atlas
# Create cluster (Free tier available)
# Get connection string: mongodb+srv://user:pass@cluster.mongodb.net/press-freely
```

**3. Configure Application:**
```bash
# SSH into EC2
ssh -i keypair.pem ubuntu@ec2-ip

# Follow VPS deployment steps above
# Use MongoDB Atlas connection string in .env
```

**4. Setup Load Balancer:**
- Create Application Load Balancer
- Add EC2 instances as targets
- Configure health checks on port 5000
- Setup SSL certificate with ACM

**5. Configure Auto-Scaling:**
- Create Launch Template from EC2 instance
- Setup Auto-Scaling Group (min: 2, max: 10)
- Configure scaling policies based on CPU

---

## Environment Configuration

### Server Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 5000 | Server port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `JWT_SECRET` | Yes | - | Secret for JWT signing (min 32 chars) |
| `NODE_ENV` | No | development | Environment mode |
| `CORS_ORIGIN` | No | * | Allowed CORS origins |
| `MAX_FILE_SIZE` | No | 10485760 | Max upload size (10MB) |
| `UPLOAD_DIR` | No | ./uploads | Upload directory path |

### Client Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_API_URL` | Yes | - | Backend API URL |
| `REACT_APP_SOCKET_URL` | Yes | - | Socket.IO server URL |
| `NODE_ENV` | No | development | Build environment |

### Generating Secure Secrets

**JWT Secret (32+ characters):**
```bash
openssl rand -base64 32
# Output: aB3dE6fG8hI0jK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0dE=
```

**Random Password:**
```bash
openssl rand -base64 16
# Output: xY9zA2bC4dE6fG8hI0jK=
```

---

## Security Considerations

### 1. Environment Security

**Protect .env Files:**
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore

# Set proper permissions (Linux/macOS)
chmod 600 .env
```

**Never Commit Secrets:**
```bash
# Check for secrets before commit
git diff --cached | grep -E "(JWT_SECRET|MONGODB_URI|password)"
```

### 2. MongoDB Security

**Enable Authentication:**
```javascript
// MongoDB shell
use admin
db.createUser({
  user: "pressfreelyAdmin",
  pwd: "strongPassword123!",
  roles: [{ role: "readWrite", db: "press-freely" }]
})
```

**Update Connection String:**
```
MONGODB_URI=mongodb://pressfreelyAdmin:strongPassword123!@localhost:27017/press-freely?authSource=admin
```

**Configure Firewall:**
```bash
# Only allow local connections
sudo ufw deny 27017
# Or allow specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 27017
```

### 3. Nginx Security Headers

Add to nginx configuration:
```nginx
# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# MIME sniffing protection
add_header X-Content-Type-Options "nosniff" always;

# Force HTTPS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### 4. Rate Limiting

Already implemented in application:
- API endpoints: 100 requests/minute
- Auth endpoints: 60 requests/minute
- Upload endpoints: 20 requests/minute

### 5. SSL/TLS Configuration

**Strong Cipher Suites:**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### 6. File Upload Security

Already implemented:
- File type validation (images, audio only)
- Size limits (10MB max)
- Secure filename generation (MD5 hash)
- Uploads stored outside web root

### 7. Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd server && npm audit fix
cd ../client && npm audit fix

# Check for security vulnerabilities
npm audit
```

---

## Troubleshooting

### Issue 1: MongoDB Connection Failed

**Symptoms:**
```
MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solutions:**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Verify connection string in .env
cat .env | grep MONGODB_URI
```

### Issue 2: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solutions:**
```bash
# Find process using port 5000
lsof -i :5000
# or
netstat -tulpn | grep 5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=5001 npm start
```

### Issue 3: WebRTC Connection Failed

**Symptoms:**
- Calls fail to connect
- "ICE connection failed" in console

**Solutions:**
```bash
# Check firewall allows UDP
sudo ufw allow proto udp to any port 10000:20000

# Verify STUN servers accessible
curl -I stun.l.google.com:19302

# Check NAT type (affects connectivity)
# Use tools like: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
```

### Issue 4: Large File Upload Timeout

**Symptoms:**
- Uploads > 5MB fail
- "Request timeout" error

**Solutions:**
```javascript
// Increase timeout in client/src/App.js
axios.defaults.timeout = 60000; // 60 seconds

// Increase Nginx timeout
// /etc/nginx/sites-available/press-freely
client_max_body_size 20M;
proxy_read_timeout 60s;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
```

### Issue 5: Socket.IO Disconnects Frequently

**Symptoms:**
- Frequent "disconnected" messages
- Messages not delivering

**Solutions:**
```javascript
// Increase timeouts in server/server.js
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: { origin: process.env.CORS_ORIGIN }
});

// Check nginx websocket config
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

### Issue 6: Build Fails on Production

**Symptoms:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solutions:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Or in package.json
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' react-scripts build"
}
```

### Issue 7: CORS Errors in Production

**Symptoms:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**
```bash
# Check CORS_ORIGIN in server .env
CORS_ORIGIN=https://yourdomain.com

# Verify in server/server.js
console.log('CORS Origin:', process.env.CORS_ORIGIN);

# Restart server
systemctl restart press-freely
```

### Issue 8: MongoDB Disk Space Full

**Symptoms:**
```
MongoError: disk full
```

**Solutions:**
```bash
# Check disk usage
df -h

# Clean old logs
find /var/log -type f -name "*.log" -mtime +30 -delete

# Compact MongoDB
mongosh
> use press-freely
> db.runCommand({ compact: 'messages' })
> db.runCommand({ compact: 'users' })

# Setup log rotation
cat > /etc/logrotate.d/press-freely << EOF
/opt/press-freely/server/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

---

## Maintenance & Monitoring

### Daily Tasks

**1. Check Application Status:**
```bash
systemctl status press-freely
systemctl status nginx
systemctl status mongod
```

**2. Monitor Logs:**
```bash
# Application logs
journalctl -u press-freely -f

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

**3. Check Disk Space:**
```bash
df -h
du -sh /opt/press-freely/server/uploads
```

### Weekly Tasks

**1. Backup Database:**
```bash
#!/bin/bash
# /opt/scripts/backup-mongo.sh

BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
mongodump --db press-freely --out $BACKUP_DIR/backup_$DATE
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Keep only last 30 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

**Schedule with cron:**
```bash
crontab -e
# Add: 0 2 * * 0 /opt/scripts/backup-mongo.sh
```

**2. Review Security Logs:**
```bash
# Failed SSH attempts
grep "Failed password" /var/log/auth.log

# Rate limit violations
grep "rate limit" /var/log/nginx/error.log

# Monitor suspicious activity
grep -E "(DROP|HACK|INJECTION)" /var/log/nginx/access.log
```

**3. Update Dependencies:**
```bash
cd /opt/press-freely/server
npm outdated
npm audit

cd ../client
npm outdated
npm audit
```

### Monthly Tasks

**1. SSL Certificate Renewal:**
```bash
# Auto-renewal should work, but verify:
certbot renew --dry-run

# Check expiration
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/cert.pem -noout -dates
```

**2. Performance Review:**
```bash
# MongoDB slow queries
mongosh
> use press-freely
> db.setProfilingLevel(1, { slowms: 100 })
> db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()

# Analyze indexes
> db.messages.getIndexes()
> db.users.getIndexes()
```

**3. Cleanup Old Files:**
```bash
# Remove uploads older than 90 days
find /opt/press-freely/server/uploads -type f -mtime +90 -delete

# Clean old messages (if implementing retention)
mongosh press-freely --eval "db.messages.deleteMany({ timestamp: { \$lt: new Date(Date.now() - 90*24*60*60*1000) } })"
```

### Monitoring Tools

**Install Node.js Process Manager (PM2):**
```bash
npm install -g pm2

# Start application with PM2
cd /opt/press-freely/server
pm2 start server.js --name press-freely

# Enable monitoring
pm2 monitor

# Setup auto-restart
pm2 startup
pm2 save
```

**Install System Monitor:**
```bash
# Install htop
apt-get install -y htop

# Install iotop for disk monitoring
apt-get install -y iotop

# Install nethogs for network monitoring
apt-get install -y nethogs
```

**Setup Uptime Monitoring:**
- Use services like UptimeRobot (https://uptimerobot.com)
- StatusCake (https://www.statuscake.com)
- Pingdom (https://www.pingdom.com)

Configure to monitor:
- https://yourdomain.com (main site)
- https://yourdomain.com/api/health (health endpoint)

---

## Performance Optimization

### 1. Enable Gzip Compression

**Nginx Configuration:**
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### 2. Browser Caching

**Already configured in nginx:**
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. MongoDB Indexing

```javascript
// Create indexes for frequent queries
mongosh press-freely
> db.users.createIndex({ username: 1 }, { unique: true })
> db.messages.createIndex({ roomId: 1, timestamp: -1 })
> db.messages.createIndex({ sender: 1, timestamp: -1 })
```

### 4. CDN Setup (Optional)

Use CloudFlare for:
- Static asset delivery
- DDoS protection
- Additional caching layer

**Setup:**
1. Sign up at https://cloudflare.com
2. Add your domain
3. Update nameservers
4. Enable caching rules
5. Configure SSL (Full mode)

---

## Support & Resources

### Documentation
- **Quick Start Guide:** `QUICK_START.md`
- **Implementation Report:** `IMPLEMENTATION_REPORT.md`
- **API Documentation:** Available in server code comments

### Useful Commands Reference

```bash
# Server management
systemctl start press-freely
systemctl stop press-freely
systemctl restart press-freely
systemctl status press-freely

# View logs
journalctl -u press-freely -f
journalctl -u press-freely --since "1 hour ago"

# Database backup
mongodump --db press-freely --out /backups/mongo-$(date +%Y%m%d)

# Database restore
mongorestore --db press-freely /backups/mongo-20260114/press-freely

# Check application health
curl http://localhost:5000/api/health
curl https://yourdomain.com/api/health

# Monitor real-time connections
watch -n 1 'netstat -an | grep :5000 | wc -l'

# Check memory usage
ps aux | grep node
top -p $(pgrep -f 'node server.js')

# Disk usage by directory
du -sh /opt/press-freely/*
du -sh /opt/press-freely/server/uploads/*
```

---

## Appendix A: Nginx Configuration Template

Complete nginx configuration for copy-paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    root /opt/press-freely/client/build;
    index index.html;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
}
```

---

## Appendix B: Complete Environment Variables

**server/.env.example:**
```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/press-freely

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-characters

# CORS
CORS_ORIGIN=https://yourdomain.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Optional: Email (for future features)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

**client/.env.example:**
```bash
# API Configuration
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_SOCKET_URL=https://yourdomain.com

# Environment
NODE_ENV=production

# Optional: Analytics
# REACT_APP_GA_TRACKING_ID=UA-XXXXXXXXX-X
```

---

## Appendix C: Systemd Service Template

**/etc/systemd/system/press-freely.service:**
```ini
[Unit]
Description=Press Freely E2EE Chat Application
Documentation=https://github.com/yourrepo/press-freely
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=pressfreelyapp
Group=pressfreelyapp
WorkingDirectory=/opt/press-freely/server

# Environment
EnvironmentFile=/opt/press-freely/server/.env
Environment=NODE_ENV=production

# Execute
ExecStart=/usr/bin/node server.js

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitInterval=200
StartLimitBurst=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=press-freely

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/press-freely/server/uploads

[Install]
WantedBy=multi-user.target
```

---

**End of Deployment Guide**

For questions or issues, refer to:
- Implementation Report: `IMPLEMENTATION_REPORT.md`
- Quick Start Guide: `QUICK_START.md`
- GitHub Issues: `<your-repo-url>/issues`

**Document Version:** 1.0  
**Last Updated:** January 14, 2026  
**Status:** Production Ready
