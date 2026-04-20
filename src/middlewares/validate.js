const { AppError } = require("../common/AppError");

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({
      params: req.params || {},
      query: req.query || {},
      body: req.body || {},
    });

    if (!parsed.success) {
      return next(new AppError("Dados de entrada invalidos", 400, parsed.error.flatten()));
    }

    req.validated = parsed.data;
    return next();
  };
}

module.exports = { validate };
