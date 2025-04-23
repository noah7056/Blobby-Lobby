@echo off
start cmd /k "cd D:\ZZ9 robe mie\AI\whole ass programs\blobby-game\vIndef (GitHub repo) && node server.js"
timeout /t 2 /nobreak >nul
start cmd /k "C:\Users\Utente\Documents\ngrok-v3-stable-windows-amd64\ngrok.exe http 3000"