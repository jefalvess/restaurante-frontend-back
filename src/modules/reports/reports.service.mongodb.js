const cache = require("../../common/cache");
const { Order, OrderItem, Payment, Product } = require("../../models");
const { requestGeminiTextPrompt } = require("../orders/orders.ai.gateway");

function parsePeriod(query) {
  const start = query.start ? new Date(query.start) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = query.end ? new Date(query.end) : new Date();
  return { start, end };
}

async function salesByPeriod(query) {
  const { start, end } = parsePeriod(query);
  const cacheKey = `reports:sales:${start.toISOString()}:${end.toISOString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const result = await Order.aggregate([
    {
      $match: {
        paidAt: { $gte: start, $lte: end },
        status: "pago",
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = result[0] || { revenue: 0, count: 0 };
  const ticketAverage = stats.count ? stats.revenue / stats.count : 0;
  const cancelled = await Order.countDocuments({ status: "cancelado", createdAt: { $gte: start, $lte: end } });

  const response = {
    period: { start, end },
    totalOrders: stats.count,
    revenue: Number(stats.revenue.toFixed(2)),
    ticketAverage: Number(ticketAverage.toFixed(2)),
    cancelled,
  };

  cache.set(cacheKey, response, 300);
  return response;
}

async function topProducts(query) {
  const { start, end } = parsePeriod(query);
  const cacheKey = `reports:topProducts:${start.toISOString()}:${end.toISOString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const items = await OrderItem.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    {
      $unwind: "$order",
    },
    {
      $match: {
        "order.paidAt": { $gte: start, $lte: end },
        "order.status": "pago",
      },
    },
    {
      $group: {
        _id: "$productName",
        quantity: { $sum: "$quantity" },
        total: { $sum: "$total" },
      },
    },
    {
      $sort: { quantity: -1 },
    },
    {
      $limit: 20,
    },
  ]);

  const response = items.map((it) => ({
    productName: it._id,
    quantity: it.quantity,
    total: Number(it.total.toFixed(2)),
  }));

  cache.set(cacheKey, response, 300);
  return response;
}

async function paymentsReport(query) {
  const { start, end } = parsePeriod(query);
  const cacheKey = `reports:payments:${start.toISOString()}:${end.toISOString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const payments = await Payment.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    {
      $unwind: "$order",
    },
    {
      $match: {
        "order.paidAt": { $gte: start, $lte: end },
        "order.status": "pago",
      },
    },
    {
      $group: {
        _id: "$method",
        amount: { $sum: "$amount" },
      },
    },
  ]);

  const summary = {
    dinheiro: 0,
    pix: 0,
    cartao: 0,
    misto: 0,
    total: 0,
  };

  payments.forEach((payment) => {
    summary[payment._id] = Number(payment.amount.toFixed(2));
    summary.total += payment.amount;
  });

  summary.total = Number(summary.total.toFixed(2));

  const response = { period: { start, end }, summary };
  cache.set(cacheKey, response, 300);
  return response;
}

async function ordersByType(query) {
  const { start, end } = parsePeriod(query);
  const cacheKey = `reports:ordersByType:${start.toISOString()}:${end.toISOString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const orders = await Order.aggregate([
    {
      $match: { createdAt: { $gte: start, $lte: end } },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {};
  orders.forEach((order) => {
    result[order._id] = order.count;
  });

  cache.set(cacheKey, result, 300);
  return result;
}

async function purchaseSuggestions(query) {
  const { start, end } = parsePeriod(query);

  // 1. Buscar top produtos vendidos no período (agrupado por nome, igual ao topProducts)
  const items = await OrderItem.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: "$order" },
    {
      $match: {
        "order.paidAt": { $gte: start, $lte: end },
        "order.status": "pago",
      },
    },
    {
      $group: {
        _id: "$productName",
        quantity: { $sum: "$quantity" },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 30 },
  ]);

  if (!items.length) {
    return {
      period: { start, end },
      suggestion: "Nenhum produto vendido no período informado para gerar sugestões.",
      products: [],
    };
  }

  // 2. Buscar descrições pelo nome do produto no cadastro
  const productNames = items.map((it) => it._id);
  const productDocs = await Product.find({ name: { $in: productNames } }, { name: 1, description: 1 }).lean();
  const descMap = new Map(productDocs.map((p) => [p.name, p.description || ""]));

  const products = items.map((it) => ({
    productName: it._id,
    description: descMap.get(it._id) || "",
    quantitySold: it.quantity,
  }));

  // 3. Montar prompt para o Gemini
  const productLines = products
    .map((p) => {
      const desc = p.description ? ` — ${p.description}` : "";
      return `- ${p.productName}${desc}: ${p.quantitySold} unidades vendidas`;
    })
    .join("\n");

  const periodLabel = `${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;

  const prompt = [
    `Você é um analista de compras de insumos para restaurante.`,
    `Seu objetivo é transformar os pratos vendidos em uma lista de ingredientes para compra.`,
    `Período analisado: ${periodLabel}.`,
    ``,
    `Regras obrigatórias:`,
    `1) NÃO repetir no resultado os dados brutos de vendas (quantidade de pratos, ranking, etc).`,
    `2) Inferir ingredientes usando nome e descrição dos pratos.`,
    `3) Estimar consumo médio por prato e calcular quantidade total sugerida para compra.`,
    `4) Incluir margem de segurança de 10% para reposição.`,
    `5) Informar estimativa de preço unitário e custo total por ingrediente em BRL.`,
    `6) Trazer ao final o total estimado de gasto no mercado (faixa mínima e máxima).`,
    `7) Se faltar informação exata, declarar a premissa de forma curta e seguir com estimativa prática.`,
    ``,
    `Formato de resposta (somente em português):`,
    `- Resumo curto de estratégia (2-4 linhas).`,
    `- Lista de compra por ingrediente no formato: Ingrediente | Qtde sugerida | Unidade | Preço unitário (R$) | Subtotal (R$) | Observação.`,
    `- Seção final: Total estimado de compra (R$ min - R$ max).`,
    ``,
    `Dados de entrada (pratos vendidos no período):`,
    productLines,
  ].join("\n");


  const suggestion = await requestGeminiTextPrompt({ prompt });

  return {
    period: { start, end },
    products,
    suggestion,
  };
}

module.exports = { salesByPeriod, topProducts, paymentsReport, ordersByType, purchaseSuggestions };
