@echo off
cd /d C:\Users\lirenxuan\Documents\yaogui\server
set PORT=3001
set JWT_SECRET=local-dev-secret
"C:\Program Files\nodejs\npm.cmd" run dev
