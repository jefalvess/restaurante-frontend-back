const jwt = require("jsonwebtoken");
const { AppError } = require("./AppError");

function getAccessSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError("JWT_SECRET nao configurado", 500);
  }
  return secret;
}

function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET || getAccessSecret();
}

function getTokenPayload(user) {
  return {
    sub: user.id,
    role: user.role,
    userName: user.userName,
  };
}

function signAccessToken(user) {
  const secret = getAccessSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || "48h";

  return jwt.sign(
    getTokenPayload(user),
    secret,
    { expiresIn }
  );
}

function signRefreshToken(user) {
  const secret = getRefreshSecret();
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

  return jwt.sign(getTokenPayload(user), secret, { expiresIn });
}

function signToken(user) {
  return signAccessToken(user);
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getAccessSecret());
  } catch (error) {
    throw new AppError("Token invalido ou expirado", 401);
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, getRefreshSecret());
  } catch (error) {
    throw new AppError("Token invalido ou expirado", 401);
  }
}

module.exports = {
  signToken,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  verifyRefreshToken,
};
