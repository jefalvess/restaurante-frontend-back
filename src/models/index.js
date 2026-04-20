const mongoose = require("mongoose");

// ===== USER SCHEMA =====
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    userName: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "gerente", "atendente"], required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ===== CATEGORY SCHEMA =====
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ===== PRODUCT SCHEMA =====
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    price: { type: Number, required: true },
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ===== INGREDIENT SCHEMA =====
const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    unit: { type: String, enum: ["g", "kg", "ml", "l", "un"], required: true },
    cost: { type: Number, required: true },
    currentStock: { type: Number, required: true },
    minStock: { type: Number, required: true },
  },
  { timestamps: true }
);

// ===== RECIPE ITEM SCHEMA =====
const recipeItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true },
  },
  { timestamps: true }
);

// ===== ORDER SCHEMA =====
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: Number, unique: true, sparse: true },
    publicId: { type: String, required: true, unique: true },
    customerName: { type: String },
    customerPhone: { type: String },
    customerAddress: { type: String },
    tableNumber: { type: String },
    type: { type: String, enum: ["mesa", "balcao", "retirada", "delivery"], required: true },
    status: {
      type: String,
      enum: ["aberto", "enviado_cozinha", "preparando", "pronto", "saiu_entrega", "entregue", "pago", "cancelado"],
      default: "aberto",
    },
    notes: { type: String },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    closedAt: { type: Date },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

orderSchema.virtual("items", {
  ref: "OrderItem",
  localField: "_id",
  foreignField: "orderId",
});

orderSchema.virtual("payments", {
  ref: "Payment",
  localField: "_id",
  foreignField: "orderId",
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

// ===== ORDER ITEM SCHEMA =====
const orderItemSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    notes: { type: String },
    accompaniment: { type: String },
    extras: { type: String },
    priceChangedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ===== PAYMENT SCHEMA =====
const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    method: { type: String, enum: ["dinheiro", "pix", "cartao", "misto"], required: true },
    amount: { type: Number, required: true },
    cashAmount: { type: Number },
    pixAmount: { type: Number },
    cardAmount: { type: Number },
    registeredById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// ===== CASH REGISTER SCHEMA =====
const cashRegisterSchema = new mongoose.Schema(
  {
    openedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    closedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    initialAmount: { type: Number, required: true },
    isOpen: { type: Boolean, default: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// ===== CASH MOVEMENT SCHEMA =====
const cashMovementSchema = new mongoose.Schema(
  {
    cashRegisterId: { type: mongoose.Schema.Types.ObjectId, ref: "CashRegister", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["entrada", "sangria"], required: true },
    amount: { type: Number, required: true },
    reason: { type: String },
  },
  { timestamps: true }
);

// ===== LOG SCHEMA =====
const logSchema = new mongoose.Schema(
  {
    entity: { type: String, required: true },
    entityId: { type: String },
    action: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ===== COUNTER SCHEMA =====
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Índices
productSchema.index({ categoryId: 1, name: 1 });
recipeItemSchema.index({ productId: 1, ingredientId: 1 }, { unique: true });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: -1 });
orderSchema.index({ createdAt: -1 });
orderItemSchema.index({ orderId: 1 });
paymentSchema.index({ orderId: 1 });
cashRegisterSchema.index({ isOpen: 1 });
logSchema.index({ entity: 1, entityId: 1 });

// Criar modelos
const User = mongoose.model("User", userSchema);
const Category = mongoose.model("Category", categorySchema);
const Product = mongoose.model("Product", productSchema);
const Ingredient = mongoose.model("Ingredient", ingredientSchema);
const RecipeItem = mongoose.model("RecipeItem", recipeItemSchema);
const Order = mongoose.model("Order", orderSchema);
const OrderItem = mongoose.model("OrderItem", orderItemSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const CashRegister = mongoose.model("CashRegister", cashRegisterSchema);
const CashMovement = mongoose.model("CashMovement", cashMovementSchema);
const Log = mongoose.model("Log", logSchema);
const Counter = mongoose.model("Counter", counterSchema);

module.exports = {
  User,
  Category,
  Product,
  Ingredient,
  RecipeItem,
  Order,
  OrderItem,
  Payment,
  CashRegister,
  CashMovement,
  Log,
  Counter,
};
