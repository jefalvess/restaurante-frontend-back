const service = require("./orders.service.mongodb");

async function create(req, res, next) {
  try {
    return res.status(201).json(await service.createOrder(req.validated.body, req.user.id));
  } catch (error) {
    return next(error);
  }
}

async function listOpen(req, res, next) {
  try {
    return res.json(await service.listOpenOrders(req.validated.query));
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    return res.json(await service.getOrderById(req.validated.params.id));
  } catch (error) {
    return next(error);
  }
}

async function addItem(req, res, next) {
  try {
    return res.json(await service.addItem(req.validated.params.id, req.validated.body, req.user.id));
  } catch (error) {
    return next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    return res.json(
      await service.updateItem(req.validated.params.id, req.validated.params.itemId, req.validated.body, req.user.id)
    );
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    return res.json(await service.removeItem(req.validated.params.id, req.validated.params.itemId, req.user.id));
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    return res.json(
      await service.updateStatus(req.validated.params.id, req.validated.body.status, req.validated.body.reason, req.user.id)
    );
  } catch (error) {
    return next(error);
  }
}

async function close(req, res, next) {
  try {
    return res.json(await service.closeOrder(req.validated.params.id, req.validated.body, req.user.id));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  listOpen,
  getById,
  addItem,
  updateItem,
  removeItem,
  updateStatus,
  close,
};
