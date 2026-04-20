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
    throw new AppError("Produto ja vendido nao pode ser excluido", 409);
  }

  await repository.remove(id);
  await registerLog({ entity: "products", entityId: id, action: "delete", payload: current, userId });
  cache.invalidate("products");

  return { message: "Produto removido" };
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
