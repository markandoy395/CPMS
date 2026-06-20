#!/bin/bash

# CPMS React + Supabase - Installation Helper Script
# This script automates the setup process

echo "🚀 CPMS React + Supabase Installation Helper"
echo "=============================================="

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher"
    echo "   Download from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and add your Supabase credentials:"
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_ANON_KEY"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if SETUP.sql exists
if [ -f "SETUP.sql" ]; then
    echo ""
    echo "📋 Setup SQL file found"
    echo "⚠️  Remember to run SETUP.sql in Supabase SQL Editor:"
    echo "   1. Go to your Supabase project"
    echo "   2. Open SQL Editor"
    echo "   3. Create new query"
    echo "   4. Paste content of SETUP.sql"
    echo "   5. Click Run"
else
    echo "⚠️  SETUP.sql not found!"
fi

echo ""
echo "✨ Installation complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Edit .env file with your Supabase credentials"
echo "   2. Run SETUP.sql in Supabase (copy and paste in SQL Editor)"
echo "   3. Start development server: npm run dev"
echo ""
echo "📖 For more information, see:"
echo "   - QUICKSTART.md - Quick setup guide"
echo "   - README.md - Full documentation"
echo "   - SETUP.md - Detailed setup instructions"
echo ""
