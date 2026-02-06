# Email Automation Platform MVP - Deployment Guide

This guide will help you deploy the Email Automation Platform on a VPS server.

## Prerequisites

- Ubuntu 20.04+ VPS server
- Domain name (optional but recommended)
- At least 2GB RAM and 20GB storage
- Root or sudo access

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS Server                               │
├─────────────────────────────────────────────────────────────┤
│  Nginx (Reverse Proxy)                                     │
│  ├── Frontend (React) - Port 80/443                        │
│  └── Backend API - Port 3000                               │
├─────────────────────────────────────────────────────────────┤
│  Application Services                                       │
│  ├── Node.js Backend Server                                │
│  ├── Email Worker Process                                  │
│  └── PM2 Process Manager                                   │
├─────────────────────────────────────────────────────────────┤
│  Databases                                                  │
│  ├── PostgreSQL (Port 5432)                               │
│  └── Redis (Port 6379)                                    │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Server Setup

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Essential Tools
```bash
sudo apt install -y curl wget git unzip software-properties-common
```

## Step 2: Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 3: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE email_automation_db;
CREATE USER email_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE email_automation_db TO email_user;
ALTER USER email_user CREATEDB;
\q
EOF
```

## Step 4: Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Change: supervised systemd
# Change: bind 127.0.0.1 ::1

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping
```

## Step 5: Install PM2 Process Manager

```bash
sudo npm install -g pm2
```

## Step 6: Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 7: Setup SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com
```

## Step 8: Deploy Application

### Clone Repository
```bash
cd /opt
sudo git clone https://github.com/yourusername/email-automation-platform.git
sudo chown -R $USER:$USER email-automation-platform
cd email-automation-platform
```

### Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

### Environment Variables (.env)
```env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="postgresql://email_user:your_secure_password_here@localhost:5432/email_automation_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production

# Email Configuration
SMTP_FROM_NAME="Your Company Name"
SMTP_FROM_EMAIL="noreply@yourdomain.com"

# Security (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Campaign Settings
OFFICE_HOURS_START=9
OFFICE_HOURS_END=17
MAX_BOUNCE_RATE=5

# Frontend URL
FRONTEND_URL=https://yourdomain.com
```

### Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Build application
npm run build
```

### Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Create production environment file
echo 'VITE_API_URL=https://yourdomain.com/api' > .env.production

# Build application
npm run build
```

## Step 9: Configure PM2 Ecosystem

Create PM2 configuration:
```bash
cd /opt/email-automation-platform
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'email-automation-api',
      script: './backend/dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true
    },
    {
      name: 'email-worker',
      script: './backend/dist/workers/email-worker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true
    }
  ]
};
```

### Create logs directory
```bash
mkdir logs
```

### Start applications
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 10: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/email-automation
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (if using Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Frontend
    location / {
        root /opt/email-automation-platform/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for file uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File upload size limit
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
```

### Enable site and restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/email-automation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 11: Setup Firewall

```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## Step 12: Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/email-automation
```

```
/opt/email-automation-platform/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reload all
    endscript
}
```

## Step 13: Setup Automated Backups

```bash
# Create backup script
sudo nano /opt/scripts/backup-database.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
DB_NAME="email_automation_db"
DB_USER="email_user"

mkdir -p $BACKUP_DIR

# Database backup
PGPASSWORD="your_secure_password_here" pg_dump -h localhost -U $DB_USER $DB_NAME > $BACKUP_DIR/database_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "database_*.sql" -mtime +7 -delete

echo "Backup completed: database_$DATE.sql"
```

```bash
# Make executable
sudo chmod +x /opt/scripts/backup-database.sh

# Add to crontab (daily backup at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /opt/scripts/backup-database.sh
```

## Step 14: Monitoring Setup

### Install monitoring tools
```bash
sudo apt install -y htop iotop
```

### Setup PM2 monitoring
```bash
# Install PM2 Plus for monitoring (optional)
pm2 install pm2-logrotate
```

## Step 15: Security Hardening

### Update system packages regularly
```bash
# Add to crontab for automatic updates
sudo crontab -e
# Add: 0 3 * * 0 apt update && apt upgrade -y
```

### Configure fail2ban (optional)
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

## Step 16: Final Testing

### Test API endpoints
```bash
curl -X GET https://yourdomain.com/api/health
```

### Monitor logs
```bash
pm2 logs
tail -f /var/log/nginx/access.log
```

### Check running services
```bash
pm2 status
sudo systemctl status postgresql
sudo systemctl status redis-server
sudo systemctl status nginx
```

## Maintenance Commands

### Application Updates
```bash
cd /opt/email-automation-platform
git pull origin main

# Backend
cd backend
npm install
npm run build
pm2 restart email-automation-api

# Frontend
cd ../frontend
npm install
npm run build

# Worker
pm2 restart email-worker
```

### Database Maintenance
```bash
# View database connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='email_automation_db';"

# Database backup
sudo -u postgres pg_dump email_automation_db > backup_$(date +%Y%m%d).sql
```

### Log Management
```bash
# View logs
pm2 logs
pm2 logs email-automation-api
pm2 logs email-worker

# Clear logs
pm2 flush
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL service: `sudo systemctl status postgresql`
   - Verify credentials in .env file
   - Check database exists: `sudo -u postgres psql -l`

2. **Redis Connection Error**
   - Check Redis service: `sudo systemctl status redis-server`
   - Test Redis: `redis-cli ping`

3. **File Upload Issues**
   - Check uploads directory permissions: `ls -la backend/uploads`
   - Increase Nginx file size limit: `client_max_body_size 10M;`

4. **Email Sending Issues**
   - Check SMTP credentials
   - Verify port accessibility
   - Check email logs in PM2

5. **High Memory Usage**
   - Monitor with: `htop`
   - Adjust PM2 instances
   - Check for memory leaks in logs

### Performance Optimization

1. **Database Optimization**
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
   CREATE INDEX idx_email_logs_campaign_id ON email_logs(campaign_id);
   CREATE INDEX idx_recipients_campaign_id ON recipients(campaign_id);
   ```

2. **Redis Optimization**
   ```bash
   # Increase Redis memory limit
   sudo nano /etc/redis/redis.conf
   # Add: maxmemory 1gb
   # Add: maxmemory-policy allkeys-lru
   ```

3. **Nginx Optimization**
   ```nginx
   # Add to server block
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

## Support and Maintenance

- Monitor server resources regularly
- Keep dependencies updated
- Backup database daily
- Monitor email delivery rates
- Review logs for errors
- Update SSL certificates before expiry

## Security Checklist

- [x] Use strong passwords for all accounts
- [x] Enable firewall (UFW)
- [x] Setup SSL/TLS certificates
- [x] Regular system updates
- [x] Database access restricted to localhost
- [x] Redis access restricted to localhost
- [x] PM2 running as non-root user
- [x] Nginx security headers configured
- [x] File upload directory secured
- [x] Environment variables protected

Your Email Automation Platform is now deployed and ready for production use!