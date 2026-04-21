const { Router } = require("express");

const { ensureAuth, ensureRole } = require("../../middlewares/auth");
const { validate } = require("../../middlewares/validate");
const controller = require("./products.controller");
const {
	createProductSchema,
	createProductsBatchSchema,
	updateProductSchema,
	productIdSchema,
} = require("./products.schema");

const router = Router();

router.use(ensureAuth);

router.get("/products", controller.list);
router.post("/products/batch", ensureRole("admin"), validate(createProductsBatchSchema), controller.createBatch);
router.post("/products", ensureRole("admin"), validate(createProductSchema), controller.create);
router.put("/products/:id", ensureRole("admin"), validate(updateProductSchema), controller.update);
router.delete("/products/:id", ensureRole("admin"), validate(productIdSchema), controller.remove);

module.exports = router;
