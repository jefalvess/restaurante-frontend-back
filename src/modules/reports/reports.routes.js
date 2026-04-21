const { Router } = require("express");

const { ensureAuth, ensureRole } = require("../../middlewares/auth");
const { validate } = require("../../middlewares/validate");
const controller = require("./reports.controller");
const { periodQuerySchema } = require("./reports.schema");

const router = Router();

router.use(ensureAuth, ensureRole("admin"));

router.get("/reports/sales", validate(periodQuerySchema), controller.sales);
router.get("/reports/top-products", validate(periodQuerySchema), controller.topProducts);
router.get("/reports/payments", validate(periodQuerySchema), controller.payments);
router.get("/reports/orders-by-type", validate(periodQuerySchema), controller.byType);
router.get("/reports/purchase-suggestions", validate(periodQuerySchema), controller.purchaseSuggestions);

module.exports = router;
