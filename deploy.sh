#!/bin/bash

# 🚀 Quick Deployment Script for Render + Vercel

echo "🚀 Starting deployment process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Preparing for deployment...${NC}"

# 1. Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${BLUE}🔄 Initializing Git repository...${NC}"
    git init
    git branch -M main
fi

# 2. Add all files to git
echo -e "${BLUE}📝 Adding files to Git...${NC}"
git add .

# 3. Commit changes
echo -e "${BLUE}💾 Committing changes...${NC}"
git commit -m "Prepare for Render + Vercel deployment" || echo "No changes to commit"

# 4. Check if remote origin exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo -e "${RED}⚠️  Please add your GitHub remote:${NC}"
    echo "git remote add origin https://github.com/yourusername/your-repo.git"
    echo "git push -u origin main"
    echo ""
fi

# 5. Push to GitHub
echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
git push origin main || echo "Please set up GitHub remote first"

echo ""
echo -e "${GREEN}✅ Code is ready for deployment!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. 🎯 Deploy Backend on Render:"
echo "   → Go to https://render.com"
echo "   → Connect GitHub repository"
echo "   → Follow backend deployment steps in DEPLOYMENT.md"
echo ""
echo "2. 🎨 Deploy Frontend on Vercel:"
echo "   → Go to https://vercel.com" 
echo "   → Connect GitHub repository"
echo "   → Follow frontend deployment steps in DEPLOYMENT.md"
echo ""
echo -e "${GREEN}📄 Complete guide: DEPLOYMENT.md${NC}"
echo -e "${GREEN}🔧 Environment template: .env.example${NC}"
echo ""
echo -e "${GREEN}🎉 Your Email Automation Platform will be live soon!${NC}"