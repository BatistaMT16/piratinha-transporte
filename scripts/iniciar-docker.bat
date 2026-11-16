@echo off
chcp 65001 > nul
title Piratinha Transporte - Iniciar Docker

echo ==================================================
echo   Piratinha Transporte - Inicializando Ambiente
echo ==================================================
echo.

cd /d "%~dp0\.."

docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] O Docker Desktop nao esta rodando!
    echo Abra o Docker Desktop e tente novamente.
    echo.
    pause
    exit /b 1
)

echo [1/2] Subindo containers (PostgreSQL, Backend, Frontend)...
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao subir os containers.
    pause
    exit /b 1
)

echo.
echo [2/2] Status dos containers:
docker compose ps

echo.
echo ==================================================
echo   Sistema pronto para acesso local:
echo   - Formulario do Cliente: http://localhost:8080
echo   - Painel da Equipe:      http://localhost:8080/equipe.html
echo   - API Healthcheck:       http://localhost:3000/api/health
echo ==================================================
echo.
pause
