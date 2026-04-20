# Guia de Setup e Execução - Backend Restaurante

## 1. Pré-requisitos

- Node.js 16+
- npm ou yarn
- PostgreSQL 12+

## 2. Instalação de dependências

Se encontrar erro de conexão de rede no npm, tente:

```bash
# Configure o npm para usar o registry público padrão
npm config set registry https://registry.npmjs.org/

# Ou use yarn (mais resistente a timeouts)
yarn install
```

Depois execute:

```bash
npm install
```

As dependências necessárias são:

```
express cors helmet morgan jsonwebtoken bcryptjs zod dotenv @prisma/client pino pino-http
```

E devDependencies:

```
prisma nodemon
```

## 3. Configuração do banco de dados

### 3.1 Criar arquivo .env

```bash
cp .env.example .env
```

### 3.2 Editar .env com suas credenciais PostgreSQL

```env
PORT=3000
JWT_SECRET=chave-segura-aqui-mude-em-producao
DATABASE_URL="postgresql://usuario:senha@localhost:5432/restaurant_db?schema=public"
```

### 3.3 Criar banco de dados PostgreSQL

```bash
# Via psql
createdb restaurant_db
```

## 4. Inicializar schema e dados

```bash
# Gerar client Prisma
npm run prisma:generate

# Rodar migrations do schema
npm run prisma:migrate

# Opcional: popular dados iniciais (admin + categorias)
npm run prisma:seed
```

## 5. Executar o servidor

### Desenvolvimento (com recarregamento automático)

```bash
npm run dev
```

A API rodará em `http://localhost:3000`

### Produção

```bash
npm start
```

## 6. Testar a API

### Health check

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{ "status": "ok", "service": "restaurant-backend" }
```

### Login (após seed)

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "admin@restaurante.local",
    "password": "admin123"
  }'
```

Resposta será um token JWT que deve ser usado em Authorization header:

```
Authorization: Bearer seu_token_aqui
```

## 7. Estrutura do projeto

```
src/
├── app.js                 # Configuração Express
├── server.js              # Entrada da aplicação
├── config/
│   └── prisma.js          # Conexão com banco
├── common/
│   ├── AppError.js        # Classe de erro customizado
│   ├── jwt.js             # Funções JWT
│   ├── logService.js      # Registro de logs
│   ├── constants.js       # Constantes do domínio
│   └── number.js          # Utilitários numéricos
├── middlewares/
│   ├── auth.js            # Autenticação e autorização
│   ├── errorHandler.js    # Tratamento central de erros
│   └── validate.js        # Validação de entrada
├── modules/
│   ├── auth/              # Autenticação
│   ├── users/             # Gestão de usuários
│   ├── categories/        # Categorias de produtos
│   ├── products/          # Cadastro de produtos
│   ├── recipes/           # Ficha técnica
│   ├── orders/            # Pedidos (maior módulo)
│   ├── cash/              # Gestão de caixa
│   ├── reports/           # Relatórios
│   └── print/             # Impressão térmica
└── routes/
    └── index.js           # Router central

prisma/
├── schema.prisma          # Schema relacional
└── seed.js                # Script de seed

```

## 8. Regras de negócio implementadas

✅ ID único por pedido (publicId com timestamp + aleatório)
✅ Tipos de pedido: mesa, balcão, retirada, delivery
✅ Status com fluxo validado (não pode pular etapas)
✅ Autenticação JWT com perfis: admin, gerente, atendente
✅ Permissões por rota
✅ Histórico de todas as alterações (logs)
✅ Registro de cancelamentos
✅ Registro de quem alterou preço
✅ Bloqueio: não fechar pedido já pago
✅ Bloqueio: não abrir caixa duplicado
✅ Bloqueio: não excluir produto já vendido
✅ Baixa automática de ingredientes ao pagar
✅ Cálculo de totais com desconto e taxa entrega
✅ Múltiplas formas de pagamento (dinheiro, pix, cartão, misto)
✅ Estoque com alerta de mínimo
✅ Relatórios: vendas, produtos top, pagamentos, estoque

## 9. Endpoints prontos

Veja [README.md](./README.md) para lista completa.

## 10. Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| PORT | Porta da API | 3000 |
| JWT_SECRET | Chave para assinar JWT | - |
| DATABASE_URL | Connection string PostgreSQL | - |

## 11. Troubleshooting

### Erro: "connect ENETDOWN"

Seu npm está apontando para um registry corporativo inacessível. Solução:

```bash
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
```

### Erro: "database connection refused"

Verifique se PostgreSQL está rodando e se DATABASE_URL está correta:

```bash
# Testar conexão
psql -U usuario -h localhost -d restaurant_db
```

### Erro: "JWT_SECRET not configured"

Adicione JWT_SECRET ao .env antes de rodar.

### Erro ao rodar migrations

```bash
# Resetar schema (CUIDADO: deleta todos os dados)
npx prisma migrate reset

# Ou refazer migrations manualmente
npx prisma migrate dev --name init
```

## 12. Próximos passos

Com o backend rodando, você pode:

1. Integrar o frontend (CORS já ativado)
2. Testar endpoints com Postman/Insomnia
3. Implementar integrações futuras (WhatsApp, QR Code, etc)
4. Ajustar regras de negócio conforme necessário
5. Deploy em produção (considere usar Docker, PM2, ReverseProxy)

## 13. Contato e suporte

Estrutura 100% modular facilita ajustes. Cada módulo é independente e pode ser expandido ou refatorado sem afetar os outros.
