# 🚀 Evolvia Technologies — Complete Production Deployment Guide

Welcome to the production deployment package for **Evolvia** (`D:\Evolvia`). This directory contains the complete, self-contained codebase ready for deployment to any cloud hosting, VPS, or local environment.

---

## 📁 Directory Structure Overview

```
D:\Evolvia\
├── company_website\          # Frontend client website & admin CRM
│   ├── index.html            # Main landing page (Global SEO, 3D Canvas, Delivered Work)
│   ├── admin.html            # Admin CRM, IP Geolocation & WhatsApp Studio
│   ├── settings.html         # Settings dashboard (SMTP, Brand, Passwords)
│   ├── evolvia_logo.png      # Official Evolvia logo asset
│   ├── robots.txt            # Search engine crawler directives
│   └── sitemap.xml           # Google Search Console XML sitemap
├── backend\                  # Express.js REST API & Auto-IP capture engine
│   ├── server.js             # Main server entry point (Port 4000)
│   ├── package.json          # Node dependencies
│   ├── .env                  # Configuration variables
│   ├── routes\               # API routing (/leads, /visitors, /settings)
│   ├── services\             # Email, GeoIP, Lead Hunter, Follow-up Cron
│   ├── models\               # MongoDB Mongoose schemas
│   └── data\                 # Resilient file-backed database storage
├── business_kit\             # Client contracts & agreements
├── start_evolvia.bat         # 1-Click Windows execution launcher
├── Dockerfile                # Production container blueprint
├── docker-compose.yml        # Multi-container orchestration with MongoDB
└── DEPLOYMENT_GUIDE.md       # This guide
```

---

## ⚡ Option 1: Quick 1-Click Launch on Windows

1. Navigate to `D:\Evolvia\`.
2. Double-click `start_evolvia.bat`.
3. The server starts instantly on port 4000:
   - 🌐 **Public Website**: `http://localhost:4000`
   - 📊 **Admin CRM**: `http://localhost:4000/admin.html` (Password: `admin` / `admin`)
   - ⚙️ **Settings**: `http://localhost:4000/settings.html`

---

## ☁️ Option 2: Deploying to a Linux VPS (Hostinger / DigitalOcean / AWS EC2 / Hetzner)

### Step 1: Upload Files to Your VPS
Use Git, SFTP, or SCP to transfer the `Evolvia` folder to your server:
```bash
# Example using scp:
scp -r D:\Evolvia root@your-server-ip:/var/www/evolvia
```

### Step 2: Install Node.js & PM2 (Process Manager)
SSH into your server and run:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 or 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally so the server runs 24/7 and restarts on reboots
sudo npm install -g pm2
```

### Step 3: Install Dependencies & Start with PM2
```bash
cd /var/www/evolvia/backend
npm install --omit=dev

# Start Evolvia with PM2
pm2 start server.js --name evolvia
pm2 save
pm2 startup
```

---

## 🔒 Step 4: Configure Domain, Nginx & Free SSL (HTTPS)

### 1. Install Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx Reverse Proxy
Edit `/etc/nginx/sites-available/evolvia`:
```nginx
server {
    server_name evolvia.com www.evolvia.com;  # Replace with your actual domain

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/evolvia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Generate Free HTTPS SSL Certificate
```bash
sudo certbot --nginx -d evolvia.com -d www.evolvia.com
```

---

## 🐳 Option 3: 1-Command Docker Deployment

If your server has Docker & Docker Compose installed:
```bash
cd D:\Evolvia
docker-compose up -d --build
```
This automatically builds the Node.js application container and attaches an isolated MongoDB 6.0 container with persistent data volumes.

---

## 🔐 Post-Deployment Checklist

1. **Change Default Admin Password**:
   - Go to `https://yourdomain.com/settings.html`
   - Change `admin` / `admin` to a strong unique password.
2. **Add Real SMTP Credentials**:
   - In Settings, enter your Gmail App Password or SendGrid/Resend API credentials to send live cold emails.
3. **Submit Sitemap to Google**:
   - Open [Google Search Console](https://search.google.com/search-console).
   - Submit your sitemap: `https://yourdomain.com/sitemap.xml`.
