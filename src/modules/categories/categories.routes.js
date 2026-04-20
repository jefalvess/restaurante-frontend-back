const { Router } = require("express");

const { ensureAuth, ensureRole } = require("../../middlewares/auth");
const { validate } = require("../../middlewares/validate");
const controller = require("./categories.controller");
const { createCategorySchema, updateCategorySchema, categoryIdSchema } = require("./categories.schema");

const router = Router();

router.use(ensureAuth);

router.get("/categories", controller.list);
router.post("/categories", ensureRole("admin"), validate(createCategorySchema), controller.create);
router.put("/categories/:id", ensureRole("admin"), validate(updateCategorySchema), controller.update);
router.delete("/categories/:id", ensureRole("admin"), validate(categoryIdSchema), controller.remove);

module.exports = router;
