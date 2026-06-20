@echo off
REM CPMS React + Supabase - Installation Helper Script (Windows)
REM This batch file automates the setup process

echo.
echo 🚀 CPMS React + Supabase Installation Helper
echo =============================================
echo.

REM Check Node.js installation
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js v16 or higher
    echo    Download from: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version
echo ✅ npm version:
npm --version
echo.

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ✅ .env file created
    echo.
    echo ⚠️  IMPORTANT: Edit .env file and add your Supabase credentials:
    echo    - VITE_SUPABASE_URL
    echo    - VITE_SUPABASE_ANON_KEY
    echo.
) else (
    echo ✅ .env file already exists
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully
echo.

REM Check if SETUP.sql exists
if exist SETUP.sql (
    echo 📋 Setup SQL file found
    echo ⚠️  Remember to run SETUP.sql in Supabase SQL Editor:
    echo    1. Go to your Supabase project
    echo    2. Open SQL Editor
    echo    3. Create new query
    echo    4. Paste content of SETUP.sql
    echo    5. Click Run
) else (
    echo ⚠️  SETUP.sql not found!
)

echo.
echo ✨ Installation complete!
echo.
echo 📚 Next steps:
echo    1. Edit .env file with your Supabase credentials
echo    2. Run SETUP.sql in Supabase (copy and paste in SQL Editor)
echo    3. Start development server: npm run dev
echo.
echo 📖 For more information, see:
echo    - QUICKSTART.md - Quick setup guide
echo    - README.md - Full documentation
echo    - SETUP.md - Detailed setup instructions
echo.
pause
