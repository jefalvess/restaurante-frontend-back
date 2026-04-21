const service = require("./reports.service.mongodb");

async function sales(req, res, next) {
  try {
    return res.json(await service.salesByPeriod(req.validated.query));
  } catch (error) {
    return next(error);
  }
}

async function topProducts(req, res, next) {
  try {
    return res.json(await service.topProducts(req.validated.query));
  } catch (error) {
    return next(error);
  }
}

async function payments(req, res, next) {
  try {
    return res.json(await service.paymentsReport(req.validated.query));
  } catch (error) {
    return next(error);
  }
}

async function byType(req, res, next) {
  try {
    return res.json(await service.ordersByType(req.validated.query));
  } catch (error) {
    return next(error);
  }
}

async function purchaseSuggestions(req, res, next) {
  try {
    return res.json(await service.purchaseSuggestions(req.validated.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { sales, topProducts, payments, byType, purchaseSuggestions };
