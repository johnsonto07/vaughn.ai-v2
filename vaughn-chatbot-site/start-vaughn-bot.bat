@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting Vaughn Bot...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or Windows cannot find it.
  echo Install Node.js, then try this file again.
  echo.
  pause
  exit /b 1
)

if "%OPENAI_API_KEY%"=="" (
  echo Paste your OpenAI API key below.
  echo It will only be used for this window.
  echo.
  set /p OPENAI_API_KEY=OpenAI API key: 
)

if "%OPENAI_API_KEY%"=="" (
  echo.
  echo No API key was entered, so Vaughn Bot cannot start.
  echo.
  pause
  exit /b 1
)

echo.
echo Leave this window open while using the website.
echo Open http://localhost:3000 in your browser.
echo.

npm start

echo.
echo Vaughn Bot stopped. If there was an error, it should be shown above.
pause
