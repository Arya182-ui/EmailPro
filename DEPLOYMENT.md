# 🚀 Render (Backend) + Vercel (Frontend) Deployment Guide

## 📋 Architecture
- **Backend**: Render Web Service (Free Tier)
- **Frontend**: Vercel Static Hosting (Free Tier) 
- **Database**: Render PostgreSQL (Free Tier)
- **Cache**: Render Redis (Free Tier)

## 🔧 Step 1: Deploy Backend on Render

### 1. Create Render Account
- Go to https://render.com
- Sign up with GitHub

### 2. Deploy Backend Service
1. Click "New +" → "Web Service"
2. Connect GitHub repository
3. Configure:
   - **Name**: `email-automation-backend`
   - **Environment**: `Node`
   - **Region**: `Oregon (US West)` (free tier)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build && npx prisma generate && npx prisma migrate deploy`
   - **Start Command**: `npm start`

### 3. Setup PostgreSQL Database
1. "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `email-automation-db`
   - **Database**: `email_automation`
   - **User**: `admin`
   - **Region**: Same as backend
3. Copy "External Database URL"

### 4. Setup Redis Cache
1. "New +" → "Redis"  
2. Configure:
   - **Name**: `email-automation-redis`
   - **Region**: Same as backend
3. Copy "Redis URL"

### 5. Backend Environment Variables
Add these in Render backend service:
```
NODE_ENV=production
DATABASE_URL=[YOUR_POSTGRES_URL_FROM_STEP_3]
REDIS_URL=[YOUR_REDIS_URL_FROM_STEP_4]
JWT_SECRET=[Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"]
FRONTEND_URL=https://your-app-name.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/tmp/uploads
```

## 🎯 Step 2: Deploy Frontend on Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy to Vercel
```bash
cd frontend
vercel --prod
```

### 3. Configure Environment Variables
In Vercel Dashboard → Your Project → Settings → Environment Variables:
```
VITE_API_URL=https://your-backend-name.onrender.com
VITE_APP_NAME=Email Automation Platform
VITE_APP_VERSION=1.0.0
```

### 4. Alternative: Deploy via GitHub
1. Go to https://vercel.com
2. Click "New Project"
3. Import from GitHub
4. Select your repository
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variables
7. Deploy

## ⚙️ Step 3: Connect Frontend & Backend

### 1. Update Backend FRONTEND_URL
In Render backend environment variables:
```
FRONTEND_URL=https://your-actual-vercel-app.vercel.app
```

### 2. Update Frontend API URL  
In Vercel environment variables:
```
VITE_API_URL=https://your-actual-render-backend.onrender.com
```

### 3. Redeploy Both Services
- Render: Automatic on environment change
- Vercel: Automatic on environment change

## 🧪 Step 4: Testing

### Health Checks:
- **Backend**: `https://your-backend.onrender.com/health`
- **Frontend**: `https://your-app.vercel.app`

### Test Features:
1. User registration/login
2. SMTP account setup
3. Template creation  
4. Campaign with CSV upload
5. Real-time notifications
6. Mobile restriction page

## 📊 Free Tier Benefits

### Render (Backend):
- ✅ **750 hours/month** (enough for 24/7)
- ✅ **PostgreSQL**: 1GB storage
- ✅ **Redis**: 25MB cache
- ✅ **SSL**: Automatic HTTPS
- ⚠️ **Limitation**: Sleeps after 15min inactivity

### Vercel (Frontend):
- ✅ **Unlimited** static hosting
- ✅ **100GB** bandwidth/month
- ✅ **SSL**: Automatic HTTPS
- ✅ **Global CDN**
- ✅ **No sleep** - always online

## 🚀 Auto-Deployment Setup

### GitHub Actions (Optional):
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Render
        run: echo "Render auto-deploys on push"
        
  frontend:
    runs-on: ubuntu-latest  
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: echo "Vercel auto-deploys on push"
```

## 🔧 Configuration Files Created:
- ✅ `render.yaml` - Render backend configuration
- ✅ `frontend/vercel.json` - Vercel frontend configuration
- ✅ `.env.example` - Environment template

## 💰 Total Cost:
- **Development**: $0/month (Free tiers)
- **Production** (if needed): $7-14/month for no-sleep services

## 🎉 Final URLs:
- **Frontend**: `https://your-app-name.vercel.app`
- **Backend**: `https://your-backend-name.onrender.com`

Your **Email Automation Platform** is now live with professional-grade hosting! 🚀