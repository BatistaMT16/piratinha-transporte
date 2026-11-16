@echo off
chcp 65001 > nul
title Piratinha Transporte - Backup do Banco

cd /d "%~dp0\.."

if not exist "backups" mkdir backups

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATA_HORA=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set ARQUIVO=backups\backup_piratinha_%DATA_HORA%.sql

echo ==================================================
echo   Piratinha Transporte - Backup PostgreSQL
echo ==================================================
echo.
echo Gerando backup em: %ARQUIVO%
echo.

docker exec piratinha_db pg_dump -U piratinha -d piratinha_db > "%ARQUIVO%"

if %errorlevel% neq 0 (
    echo [ERRO] Nao foi possivel gerar o backup. Verifique se o container piratinha_db esta rodando.
    pause
    exit /b 1
)

echo [OK] Backup salvo com sucesso em %ARQUIVO%!
echo.
pause
