const { AppError } = require("../../common/AppError");
const { registerLog } = require("../../common/logService");
const cache = require("../../common/cache");
const { Category } = require("../../models");
const repository = require("./products.repository");

async function listProducts() {
  const cacheKey = "products:list";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const products = await repository.list();
  cache.set(cacheKey, products, 600);
  return products;
}

async function createProduct(data, userId) {
  const category = await Category.findById(data.categoryId);
  if (!category) {
    throw new AppError("Categoria nao encontrada", 404);
  }

  const created = await repository.create(data);
  await registerLog({ entity: "products", entityId: created.id, action: "create", payload: created, userId });
  cache.invalidate("products");
  return created;
}

async function createProductsBatch(products, userId) {
  const categoryIds = [...new Set(products.map((item) => String(item.categoryId)))];
  const categories = await Category.find({ _id: { $in: categoryIds } }).select("_id");
  const foundIds = new Set(categories.map((item) => String(item._id)));

  const missingCategoryId = categoryIds.find((id) => !foundIds.has(id));
  if (missingCategoryId) {
    throw new AppError(`Categoria nao encontrada: ${missingCategoryId}`, 404);
  }

  const createdProducts = await repository.createMany(products);

  await registerLog({
    entity: "products",
    entityId: null,
    action: "create_batch",
    payload: { count: createdProducts.length, productIds: createdProducts.map((item) => String(item._id)) },
    userId,
  });

  cache.invalidate("products");
  return createdProducts;
}

async function updateProduct(id, data, userId) {
  const current = await repository.findById(id);
  if (!current) {
    throw new AppError("Produto nao encontrado", 404);
  }

  if (data.categoryId) {
    const category = await Category.findById(data.categoryId);
    if (!category) {
      throw new AppError("Categoria nao encontrada", 404);
    }
  }

  const updated = await repository.update(id, data);
  await registerLog({ entity: "products", entityId: id, action: "update", payload: data, userId });
  cache.invalidate("products");
  return updated;
}

async function deleteProduct(id, userId) {
  const current = await repository.findById(id);
  if (!current) {
    throw new AppError("Produto nao encontrado", 404);
  }

  const sold = await repository.findSoldItemByProduct(id);
  if (sold) {
    // Produto com histórico de vendas: apenas oculta (soft delete)
    const updated = await repository.update(id, { active: false });
    await registerLog({ entity: "products", entityId: id, action: "deactivate", payload: { reason: "sold" }, userId });
    cache.invalidate("products");
    return { message: "Produto desativado (possui historico de vendas)", product: updated };
  }

  await repository.remove(id);
  await registerLog({ entity: "products", entityId: id, action: "delete", payload: current, userId });
  cache.invalidate("products");

  return { message: "Produto removido" };
}

module.exports = { listProducts, createProduct, createProductsBatch, updateProduct, deleteProduct };
