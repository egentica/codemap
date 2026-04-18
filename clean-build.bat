@echo off
REM Clean build script for CodeMap
REM Removes dist directory and rebuilds from scratch

echo Cleaning dist directory...
if exist dist rmdir /s /q dist

echo Building TypeScript...
npm run build

echo.
echo Build complete!
