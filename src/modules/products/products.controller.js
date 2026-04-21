const service = require("./products.service");

async function list(req, res, next) {
  try {
    return res.json(await service.listProducts());
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    return res.status(201).json(await service.createProduct(req.validated.body, req.user.id));
  } catch (error) {
    return next(error);
  }
}

async function createBatch(req, res, next) {
  try {
    return res.status(201).json(await service.createProductsBatch(req.validated.body.products, req.user.id));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    return res.json(await service.updateProduct(req.validated.params.id, req.validated.body, req.user.id));
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    return res.json(await service.deleteProduct(req.validated.params.id, req.user.id));
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, createBatch, update, remove };
