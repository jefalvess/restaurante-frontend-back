const cache = require("../../common/cache");
const { Order, OrderItem, Payment } = require("../../models");

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

module.exports = { salesByPeriod, topProducts, paymentsReport, ordersByType };
