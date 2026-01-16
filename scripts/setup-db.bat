@echo off
echo Setting up Tweet Garot PM Database...
echo.

REM Check if psql is available
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PostgreSQL is not installed or not in PATH
    echo Please install PostgreSQL from https://www.postgresql.org/download/windows/
    exit /b 1
)

echo Creating database 'tweetgarot_pm'...
psql -U postgres -c "CREATE DATABASE tweetgarot_pm;" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Database created successfully!
) else (
    echo Database may already exist, continuing...
)

echo.
echo Running migrations...
cd /d "%~dp0..\backend"
call npm run migrate

echo.
set /p SEED="Do you want to add sample test data? (y/n): "
if /i "%SEED%"=="y" (
    echo.
    echo Seeding database with test data...
    call npm run seed
)

echo.
echo Database setup complete!
echo.
echo Next steps:
echo 1. Run 'npm run dev' from the backend directory
echo 2. Run 'npm start' from the frontend directory
echo 3. Login with admin@tweetgarot.com / password123
pause
