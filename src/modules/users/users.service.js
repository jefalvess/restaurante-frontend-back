const bcrypt = require("bcryptjs");

const { AppError } = require("../../common/AppError");
const { registerLog } = require("../../common/logService");
const cache = require("../../common/cache");
const usersRepository = require("./users.repository");

async function listUsers() {
  const cacheKey = "users:list";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const users = await usersRepository.listUsers();
  cache.set(cacheKey, users, 3600);
  return users;
}

async function createUser(data) {
  const exists = await usersRepository.findByEmail(data.userName);
  if (exists) {
    throw new AppError("Email ja cadastrado", 409);
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await usersRepository.createUser({
    name: data.name,
    userName: data.userName,
    passwordHash,
    role: data.role,
    active: data.active ?? true,
  });

  await registerLog({
    entity: "users",
    entityId: user.id,
    action: "create",
    payload: user,
    userId: null,
  });
  cache.invalidate("users");

  return user;
}

async function createBootstrapUser(data) {
  const usersCount = await usersRepository.countUsers();
  if (usersCount > 0) {
    throw new AppError("Bootstrap desabilitado: ja existe usuario cadastrado", 409);
  }

  return createUser(
    {
      ...data,
      role: data.role || "admin",
      active: data.active ?? true,
    }
  );
}


async function deactivateUser(id, currentUser) {
  const existing = await usersRepository.findById(id);
  if (!existing) {
    throw new AppError("Usuario nao encontrado", 404);
  }

  const user = await usersRepository.updateUser(id, { active: false });

  await registerLog({
    entity: "users",
    entityId: id,
    action: "deactivate",
    payload: { active: false },
    userId: currentUser?.id || null,
  });
  cache.invalidate("users");

  return user;
}

module.exports = {
  listUsers,
  createBootstrapUser,
  createUser,
  deactivateUser,
};
