const { Router } = require("express");

const { ensureAuth } = require("../../middlewares/auth");
const { validate } = require("../../middlewares/validate");
const controller = require("./orders.controller");
const {
  createOrderSchema,
  listOrdersSchema,
  orderIdSchema,
  addItemSchema,
  updateItemSchema,
  itemIdSchema,
  updateStatusSchema,
  closeOrderSchema,
} = require("./orders.schema");

const router = Router();

router.use(ensureAuth);

router.post("/orders", validate(createOrderSchema), controller.create);
router.get("/orders/open", validate(listOrdersSchema), controller.listOpen);
router.get("/orders/:id", validate(orderIdSchema), controller.getById);
router.post("/orders/:id/items", validate(addItemSchema), controller.addItem);
router.put("/orders/:id/items/:itemId", validate(updateItemSchema), controller.updateItem);
router.delete("/orders/:id/items/:itemId", validate(itemIdSchema), controller.removeItem);
router.put("/orders/:id/status", validate(updateStatusSchema), controller.updateStatus);
router.post("/orders/:id/close", validate(closeOrderSchema), controller.close);

module.exports = router;
