#!/bin/bash

# Render Build Script for Backend
echo "🚀 Starting Render build process..."

# Set environment
export NODE_ENV=production

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

echo "🗄️ Generating Prisma client..."
npx prisma generate

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Build completed successfully!"

# Keep some logs for debugging
echo "📊 Build stats:"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Dist folder size: $(du -sh dist 2>/dev/null || echo 'N/A')"

echo "🎉 Ready for deployment!"