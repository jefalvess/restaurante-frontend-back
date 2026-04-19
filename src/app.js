const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const routes = require("./routes");
const { errorHandler } = require("./middlewares/errorHandler");
const { connectDB } = require("./config/mongodb");
const { swaggerDocument } = require("./config/swagger");

const app = express();

// Conectar ao MongoDB
connectDB().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao conectar ao MongoDB:", err);
  process.exit(1);
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "restaurant-backend" });
});

app.use("/docs", swaggerUi.serve);
app.get("/docs", swaggerUi.setup(swaggerDocument));

app.use("/", routes);
app.use(errorHandler);

module.exports = app;
