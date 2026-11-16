@echo off
chcp 65001 > nul
title Piratinha Transporte - Salvar no GitHub

cd /d "%~dp0\.."

echo ==================================================
echo   Piratinha Transporte - Enviar para o GitHub
echo ==================================================
echo.

set /p msg="Descricao da alteracao: "
if "%msg%"=="" set msg=Atualizacao Piratinha Transporte

git add .
git commit -m "%msg%"
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao enviar para o GitHub. Verifique sua conexao ou autenticacao Git.
    pause
    exit /b 1
)

echo.
echo [OK] Alteracoes enviadas com sucesso para o GitHub!
echo.
pause
