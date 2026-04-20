const { AppError } = require("../../common/AppError");
const { registerLog } = require("../../common/logService");
const { Category } = require("../../models");
const repository = require("./products.repository");

async function listProducts() {
  return repository.list();
}

async function createProduct(data, userId) {
  const category = await Category.findById(data.categoryId);
  if (!category) {
    throw new AppError("Categoria nao encontrada", 404);
  }

  const created = await repository.create(data);
  await registerLog({ entity: "products", entityId: created.id, action: "create", payload: created, userId });
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

  return { message: "Produto removido" };
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
