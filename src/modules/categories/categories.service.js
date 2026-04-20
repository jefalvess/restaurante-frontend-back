const { AppError } = require("../../common/AppError");
const { registerLog } = require("../../common/logService");
const cache = require("../../common/cache");
const repository = require("./categories.repository");

async function listCategories() {
  const cacheKey = "categories:list";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const categories = await repository.list();
  cache.set(cacheKey, categories, 3600);
  return categories;
}

async function createCategory(data, userId) {
  const exists = await repository.findByName(data.name);
  if (exists) {
    throw new AppError("Categoria ja cadastrada", 409);
  }

  const created = await repository.create({ name: data.name, active: data.active ?? true });
  await registerLog({ entity: "categories", entityId: created.id, action: "create", payload: created, userId });
  cache.invalidate("categories");
  return created;
}

async function updateCategory(id, data, userId) {
  const current = await repository.findById(id);
  if (!current) {
    throw new AppError("Categoria nao encontrada", 404);
  }

  if (data.name && data.name !== current.name) {
    const nameTaken = await repository.findByName(data.name);
    if (nameTaken) {
      throw new AppError("Categoria ja cadastrada", 409);
    }
  }

  const updated = await repository.update(id, data);
  await registerLog({ entity: "categories", entityId: id, action: "update", payload: data, userId });
  cache.invalidate("categories");
  return updated;
}

async function deleteCategory(id, userId) {
  const current = await repository.findById(id);
  if (!current) {
    throw new AppError("Categoria nao encontrada", 404);
  }

  await repository.remove(id);
  await registerLog({ entity: "categories", entityId: id, action: "delete", payload: current, userId });
  cache.invalidate("categories");
  return { message: "Categoria removida" };
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
