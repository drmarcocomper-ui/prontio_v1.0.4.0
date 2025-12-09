#!/bin/bash

echo "============================================"
echo "   SCRIPT DE REORGANIZAÇÃO DO PRONTIO"
echo "============================================"
echo ""

# Confirmação
read -p "Este script vai reorganizar a estrutura do PRONTIO. Deseja continuar? (s/n) " resp
if [[ "$resp" != "s" ]]; then
    echo "Operação cancelada."
    exit 0
fi

echo ""
echo "▶ Criando estrutura de diretórios base..."

# Criar pastas padrão do projeto
mkdir -p frontend
mkdir -p backend/dev
mkdir -p backend/prod
mkdir -p docs
mkdir -p tests/frontend
mkdir -p tests/backend-dev
mkdir -p tests/backend-prod
mkdir -p tools

echo "✔ Diretórios base criados."

echo ""
echo "▶ Movendo páginas HTML da raiz para /frontend..."

# Move todos os .html da raiz para frontend (se existirem)
shopt -s nullglob
for file in *.html; do
    if [[ -f "$file" ]]; then
        mv "$file" frontend/
        echo "  → Movido: $file → frontend/"
    fi
done
shopt -u nullglob

echo "✔ Páginas HTML organizadas."

echo ""
echo "▶ Movendo pasta /assets para dentro de /frontend..."

if [[ -d "assets" ]]; then
    # Se já existir frontend/assets, não sobrescreve à força
    if [[ -d "frontend/assets" ]]; then
        echo "⚠ Já existe frontend/assets."
        read -p "Deseja mesclar assets/ dentro de frontend/assets? (s/n) " resp_assets
        if [[ "$resp_assets" == "s" ]]; then
            # move conteúdo interno de assets para frontend/assets
            rsync -av assets/ frontend/assets/
            rm -rf assets
            echo "✔ Conteúdo de assets/ mesclado em frontend/assets/."
        else
            echo "↷ Mantive assets/ na raiz. Ajuste manualmente depois."
        fi
    else
        mv assets frontend/
        echo "✔ Pasta assets movida para frontend/assets."
    fi
else
    echo "ℹ Nenhuma pasta assets na raiz (ok se você já moveu manualmente)."
fi

echo ""
echo "▶ Garantindo estrutura de JS dentro de frontend/assets/js..."

JS_DIR="frontend/assets/js"

if [[ -d "$JS_DIR" ]]; then
    # cria as pastas, mas NÃO move nada automaticamente
    mkdir -p "$JS_DIR/core"
    mkdir -p "$JS_DIR/pages"
    mkdir -p "$JS_DIR/widgets"
    mkdir -p "$JS_DIR/print"

    echo "✔ Pastas core/, pages/, widgets/ e print/ garantidas em $JS_DIR."

    echo ""
    echo "⚠ Aviso:"
    echo "  - Se você já tem subpastas como ui/, core/, pages/, elas permanecem como estão."
    echo "  - Arquivos app.js e main.js continuarão em $JS_DIR."
    echo "  - Nada será renomeado automaticamente para não quebrar seus <script src=\"...\">."
    echo ""
    echo "Quando quiser, podemos criar um script separado só para:"
    echo "  - migrar ui/ para widgets/;"
    echo "  - mover app.js e main.js para core/ atualizando seus HTML."
else
    echo "ℹ Nenhuma pasta frontend/assets/js encontrada ainda. Sem alterações em JS."
fi

echo ""
echo "▶ Preparando backend (DEV e PROD)..."

# Move arquivos .gs da raiz para backend/dev, se houver
shopt -s nullglob
for file in *.gs; do
    if [[ -f "$file" ]]; then
        mv "$file" backend/dev/
        echo "  → Movido: $file → backend/dev/"
    fi
done
shopt -u nullglob

# Cria .clasp.json se ainda não existir
if [[ ! -f "backend/dev/.clasp.json" ]]; then
    cat > backend/dev/.clasp.json <<EOF
{
  "scriptId": "",
  "rootDir": "./"
}
EOF
    echo "✔ Criado backend/dev/.clasp.json (preencha o ScriptId DEV)."
fi

if [[ ! -f "backend/prod/.clasp.json" ]]; then
    cat > backend/prod/.clasp.json <<EOF
{
  "scriptId": "",
  "rootDir": "./"
}
EOF
    echo "✔ Criado backend/prod/.clasp.json (preencha o ScriptId PROD)."
fi

echo ""
echo "▶ Criando manifest appsscript.json nos ambientes, se faltando..."

if [[ ! -f "backend/dev/appsscript.json" ]]; then
    cat > backend/dev/appsscript.json <<EOF
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF
    echo "✔ backend/dev/appsscript.json criado."
fi

if [[ ! -f "backend/prod/appsscript.json" ]]; then
    cat > backend/prod/appsscript.json <<EOF
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF
    echo "✔ backend/prod/appsscript.json criado."
fi

echo ""
echo "▶ Criando arquivos README.md padrão..."

if [[ ! -f "docs/README.md" ]]; then
    echo "# Documentação do PRONTIO" > docs/README.md
    echo "✔ docs/README.md criado."
fi

echo "# Testes de frontend" > tests/frontend/README.md
echo "# Testes backend (dev)" > tests/backend-dev/README.md
echo "# Testes backend (prod)" > tests/backend-prod/README.md
echo "✔ READMEs de testes criados."

echo ""
echo "============================================"
echo "   ✔ REORGANIZAÇÃO CONCLUÍDA COM SUCESSO!"
echo "============================================"
echo ""
echo "Revise:"
echo "  - frontend/ (HTML + assets)"
echo "  - backend/dev/.clasp.json e backend/prod/.clasp.json (ScriptIds)"
echo ""
echo "Depois disso, você já pode:"
echo "  cd backend/dev  && clasp push"
echo "  cd backend/prod && clasp push"
