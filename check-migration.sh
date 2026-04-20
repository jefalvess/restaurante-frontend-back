#!/bin/bash
# Checklist de Migração MongoDB
# Use este arquivo para acompanhar o progresso

echo "📋 CHECKLIST DE MIGRAÇÃO MONGODB"
echo "=================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_DIR="/Users/jefersonluisalvesdesouza/Desktop/test-copit"
PASS="${GREEN}✅${NC}"
FAIL="${RED}❌${NC}"
WARN="${YELLOW}⚠️${NC}"

# Função para verificar arquivo
check_file() {
    if [ -f "$1" ]; then
        echo -e "$PASS $2"
        return 0
    else
        echo -e "$FAIL $2 (não encontrado: $1)"
        return 1
    fi
}

# Função para verificar conteúdo
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "$PASS $3"
        return 0
    else
        echo -e "$FAIL $3"
        return 1
    fi
}

count_passed=0
count_total=0

# ============================================
echo "1️⃣  CONFIGURAÇÃO"
echo "============================================"

((count_total++))
if check_file "$BASE_DIR/src/config/mongodb.js" "mongodb.js criado"; then
    ((count_passed++))
fi

((count_total++))
if check_file "$BASE_DIR/src/models/index.js" "models/index.js criado"; then
    ((count_passed++))
fi

((count_total++))
if check_content "$BASE_DIR/src/app.js" "connectDB" "app.js com connectDB()"; then
    ((count_passed++))
fi

((count_total++))
if check_content "$BASE_DIR/.env.example" "MONGODB_URI" ".env.example com MONGODB_URI"; then
    ((count_passed++))
fi

# ============================================
echo ""
echo "2️⃣  REPOSITÓRIOS"
echo "============================================"

repos=("auth" "users" "categories" "products" "recipes" "orders" "cash")
for repo in "${repos[@]}"; do
    ((count_total++))
    repo_file="$BASE_DIR/src/modules/$repo/${repo%s}.repository.js"
    if check_content "$repo_file" "require.*models" "$repo.repository.js convertido"; then
        ((count_passed++))
    fi
done

# ============================================
echo ""
echo "3️⃣  SERVIÇOS MONGODB (NOVOS)"
echo "============================================"

((count_total++))
if check_file "$BASE_DIR/src/modules/orders/orders.service.mongodb.js" "orders.service.mongodb.js criado"; then
    ((count_passed++))
fi

((count_total++))
if check_file "$BASE_DIR/src/modules/reports/reports.service.mongodb.js" "reports.service.mongodb.js criado"; then
    ((count_passed++))
fi

((count_total++))
if check_file "$BASE_DIR/src/modules/print/print.service.mongodb.js" "print.service.mongodb.js criado"; then
    ((count_passed++))
fi

# ============================================
echo ""
echo "4️⃣  SERVIÇOS CONVERTIDOS"
echo "============================================"

((count_total++))
if check_content "$BASE_DIR/src/modules/orders/orders.service.js" "const { Order" "orders.service.js convertido"; then
    ((count_passed++))
else
    echo -e "$WARN orders.service.js não convertido ainda"
fi

((count_total++))
if check_content "$BASE_DIR/src/modules/reports/reports.service.js" "aggregation\\|aggregate" "reports.service.js convertido"; then
    ((count_passed++))
else
    echo -e "$WARN reports.service.js não convertido ainda"
fi

((count_total++))
if check_content "$BASE_DIR/src/modules/print/print.service.js" "const { Order" "print.service.js convertido"; then
    ((count_passed++))
else
    echo -e "$WARN print.service.js não convertido ainda"
fi

# ============================================
echo ""
echo "5️⃣  UTILITÁRIOS"
echo "============================================"

((count_total++))
if check_content "$BASE_DIR/src/common/logService.js" "const { Log" "logService.js convertido"; then
    ((count_passed++))
fi

# ============================================
echo ""
echo "6️⃣  DOCUMENTAÇÃO"
echo "============================================"

docs=("MIGRACAO_MONGODB.md" "FINALIZACAO_MONGODB.md" "MONGODB_SUMMARY.md" "ESTRUTURA_ANTES_DEPOIS.md")
for doc in "${docs[@]}"; do
    ((count_total++))
    if check_file "$BASE_DIR/$doc" "$doc criado"; then
        ((count_passed++))
    fi
done

# ============================================
echo ""
echo "7️⃣  SCRIPTS"
echo "============================================"

((count_total++))
if check_file "$BASE_DIR/finalize-mongodb.sh" "finalize-mongodb.sh criado"; then
    ((count_passed++))
fi

# ============================================
echo ""
echo "8️⃣  DEPENDÊNCIAS"
echo "============================================"

((count_total++))
if check_content "$BASE_DIR/package.json" "mongoose" "Mongoose em package.json"; then
    ((count_passed++))
else
    echo -e "$WARN Mongoose não instalado ainda - execute: npm install mongoose mongodb"
fi

((count_total++))
if ! grep -q "@prisma/client" "$BASE_DIR/package.json" 2>/dev/null; then
    echo -e "$PASS Prisma removido de package.json"
    ((count_passed++))
else
    echo -e "$WARN Prisma ainda em package.json - execute: npm uninstall @prisma/client prisma"
fi

# ============================================
echo ""
echo "9️⃣  BANCO DE DADOS"
echo "============================================"

if mongosh --eval "db.version()" > /dev/null 2>&1; then
    echo -e "$PASS MongoDB rodando"
    ((count_passed++))
else
    echo -e "$WARN MongoDB não encontrado - inicie com: brew services start mongodb-community"
fi
((count_total++))

# ============================================
echo ""
echo "🔟 SERVIDOR"
echo "============================================"

if [ -f "$BASE_DIR/.env" ]; then
    echo -e "$PASS .env criado"
    ((count_passed++))
else
    echo -e "$WARN .env não criado"
fi
((count_total++))

# ============================================
echo ""
echo "=================================="
echo "📊 RESULTADO FINAL"
echo "=================================="

percentage=$((count_passed * 100 / count_total))
echo ""
echo "Completado: $count_passed/$count_total ($percentage%)"
echo ""

if [ $percentage -eq 100 ]; then
    echo -e "${GREEN}🎉 MIGRAÇÃO COMPLETA!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. npm run dev"
    echo "2. Testar endpoints em outro terminal"
elif [ $percentage -ge 95 ]; then
    echo -e "${YELLOW}✨ MIGRAÇÃO 95% COMPLETA!${NC}"
    echo ""
    echo "Faltam apenas:"
    echo "1. Copiar 3 arquivos .mongodb.js"
    echo "2. npm install mongoose"
    echo "3. npm run dev"
    echo ""
    echo "Execute: bash finalize-mongodb.sh"
else
    echo -e "${YELLOW}⚠️ MIGRAÇÃO EM PROGRESSO (${percentage}%)${NC}"
    echo ""
    echo "Faltam vários passos. Siga FINALIZACAO_MONGODB.md"
fi

echo ""
