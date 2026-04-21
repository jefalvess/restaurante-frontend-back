const { AppError } = require("../../common/AppError");
const { ORDER_STATUS_FLOW } = require("../../common/constants");
const { registerLog } = require("../../common/logService");
const cache = require("../../common/cache");
const { Order, OrderItem, Product, Payment, Counter } = require("../../models");
const repository = require("./orders.repository");

function generatePublicId(orderNumber) {
  return `PED-${String(orderNumber).padStart(6, "0")}`;
}

async function getNextOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { key: "order_number" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  );

  return counter.seq;
}

function calcTotals(items, discount, deliveryFee) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);
  const total = subtotal - Number(discount || 0) + Number(deliveryFee || 0);
  if (total < 0) {
    throw new AppError("Total final nao pode ser negativo", 400);
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

async function ensureOrderEditable(order) {
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  if (["pago", "cancelado"].includes(order.status)) {
    throw new AppError("Pedido nao pode ser alterado", 409);
  }
}

async function createOrder(data, userId) {
  const orderNumber = await getNextOrderNumber();

  const order = new Order({
    orderNumber,
    publicId: generatePublicId(orderNumber),
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress,
    tableNumber: data.tableNumber,
    type: data.type,
    notes: data.notes,
    createdById: userId,
    status: "aberto",
  });

  await order.save();

  await registerLog({
    entity: "orders",
    entityId: order._id.toString(),
    action: "create",
    payload: order,
    userId,
  });
  cache.invalidate("orders");
  return order;
}

async function listOpenOrders(filters = {}) {
  const cacheKey = `orders:open:${JSON.stringify(filters)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const query = {};
  const requestedType = filters.type;

  if (filters.status) {
    query.status = filters.status;
  }

  if (requestedType) {
    query.type = requestedType;
  }

  let orders;

  if (query.status === "pago" || query.status === "cancelado") {
    orders = await Order.find(query).populate("items").sort({ updatedAt: -1 });
  } else {
    orders = await Order.find(query)
      .populate("items")
      .sort({ orderNumber: -1});
  }

  cache.set(cacheKey, orders, 30);
  return orders;
}

async function getOrderById(id) {
  const order = await Order.findById(id).populate("items").populate("payments");
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  return order;
}

async function addItem(orderId, data, userId) {
  const order = await Order.findById(orderId);
  await ensureOrderEditable(order);

  const product = await Product.findById(data.productId);
  if (!product || !product.active) {
    throw new AppError("Produto nao encontrado ou inativo", 404);
  }

  const unitPrice = Number(data.unitPrice ?? product.price);
  const total = Number((unitPrice * data.quantity).toFixed(2));

  const item = new OrderItem({
    orderId,
    productId: product._id,
    productName: product.name,
    quantity: data.quantity,
    unitPrice,
    total,
    notes: data.notes,
    accompaniment: data.accompaniment,
    extras: data.extras,
    priceChangedById: data.unitPrice ? userId : null,
  });

  await item.save();
  const updatedOrder = await recalcOrder(orderId);

  await registerLog({
    entity: "order_items",
    entityId: item._id.toString(),
    action: "create",
    payload: { ...item.toObject(), changedPrice: Boolean(data.unitPrice) },
    userId,
  });
  cache.invalidate("orders");

  return updatedOrder;
}

async function updateItem(orderId, itemId, data, userId) {
  const order = await Order.findById(orderId);
  await ensureOrderEditable(order);

  const item = await OrderItem.findById(itemId);
  if (!item || item.orderId.toString() !== orderId) {
    throw new AppError("Item nao encontrado", 404);
  }

  const quantity = data.quantity ?? item.quantity;
  const unitPrice = data.unitPrice ?? Number(item.unitPrice);
  const payload = {
    quantity,
    unitPrice,
    total: Number((quantity * unitPrice).toFixed(2)),
    notes: data.notes ?? item.notes,
    accompaniment: data.accompaniment ?? item.accompaniment,
    extras: data.extras ?? item.extras,
  };

  if (data.unitPrice && Number(data.unitPrice) !== Number(item.unitPrice)) {
    payload.priceChangedById = userId;
  }

  await OrderItem.findByIdAndUpdate(itemId, payload);
  const updatedOrder = await recalcOrder(orderId);

  await registerLog({
    entity: "order_items",
    entityId: itemId,
    action: "update",
    payload,
    userId,
  });
  cache.invalidate("orders");
  return updatedOrder;
}

async function removeItem(orderId, itemId, userId) {
  const order = await Order.findById(orderId);
  await ensureOrderEditable(order);

  const item = await OrderItem.findById(itemId);
  if (!item || item.orderId.toString() !== orderId) {
    throw new AppError("Item nao encontrado", 404);
  }

  await OrderItem.findByIdAndDelete(itemId);
  const updatedOrder = await recalcOrder(orderId);

  await registerLog({
    entity: "order_items",
    entityId: itemId,
    action: "delete",
    payload: item,
    userId,
  });
  cache.invalidate("orders");
  return updatedOrder;
}

async function recalcOrder(
  orderId,
  discount = undefined,
  deliveryFee = undefined,
) {
  const order = await Order.findById(orderId).populate("items");
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  const discountValue =
    discount !== undefined ? Number(discount) : Number(order.discount);
  const deliveryValue =
    deliveryFee !== undefined ? Number(deliveryFee) : Number(order.deliveryFee);
  const totals = calcTotals(order.items, discountValue, deliveryValue);

  return Order.findByIdAndUpdate(
    orderId,
    {
      subtotal: totals.subtotal,
      discount: discountValue,
      deliveryFee: deliveryValue,
      total: totals.total,
    },
    { returnDocument: "after" },
  )
    .populate("items")
    .populate("payments");
}

async function updateStatus(orderId, status, reason, userId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  if (order.status === "pago") {
    throw new AppError("Pedido ja pago nao pode mudar status", 409);
  }

  const allowed = ORDER_STATUS_FLOW[order.status] || [];
  if (!allowed.includes(status)) {
    throw new AppError(`Transicao invalida: ${order.status} -> ${status}`, 400);
  }

  const payload = { status };
  if (status === "cancelado") {
    payload.cancelledAt = new Date();
  }

  const updated = await Order.findByIdAndUpdate(orderId, payload, { returnDocument: "after" })
    .populate("items")
    .populate("payments");

  await registerLog({
    entity: "orders",
    entityId: orderId,
    action: status === "cancelado" ? "cancel" : "status_update",
    payload: { oldStatus: order.status, status, reason },
    userId,
  });
  cache.invalidate("orders");
  cache.invalidate("reports");

  return updated;
}

async function closeOrder(orderId, data, userId) {
  const order = await Order.findById(orderId).populate("items");
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  if (order.status === "pago") {
    throw new AppError("Pedido ja pago", 409);
  }

  if (order.items.length === 0) {
    throw new AppError("Pedido sem itens nao pode ser fechado", 400);
  }

  const updatedOrder = await recalcOrder(
    orderId,
    data.discount,
    data.deliveryFee,
  );

  const total = Number(updatedOrder.total);
  const cashAmount = Number(data.cashAmount || 0);
  const pixAmount = Number(data.pixAmount || 0);
  const cardAmount = Number(data.cardAmount || 0);

  if (data.paymentMethod === "misto") {
    const mixedTotal = Number((cashAmount + pixAmount + cardAmount).toFixed(2));
    if (mixedTotal !== Number(total.toFixed(2))) {
      throw new AppError("Pagamento misto nao confere com o total", 400);
    }
  }

  // Usar sessão para transação ACID
  const session = await Order.startSession();
  session.startTransaction();

  try {
    // Criar pagamento
    const payment = new Payment({
      orderId,
      method: data.paymentMethod,
      amount: total,
      cashAmount: cashAmount || null,
      pixAmount: pixAmount || null,
      cardAmount: cardAmount || null,
      registeredById: userId,
    });
    await payment.save({ session });

    // Atualizar pedido como pago
    await Order.findByIdAndUpdate(
      orderId,
      {
        status: "pago",
        closedAt: new Date(),
        paidAt: new Date(),
      },
      { session },
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

  await registerLog({
    entity: "orders",
    entityId: orderId,
    action: "close",
    payload: {
      discount: data.discount,
      deliveryFee: data.deliveryFee,
      paymentMethod: data.paymentMethod,
      total,
    },
    userId,
  });
  cache.invalidate("orders");
  cache.invalidate("reports");

  return Order.findById(orderId).populate("items").populate("payments");
}

async function deleteOrder(orderId, userId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  // Mantem rastreabilidade financeira: pedido pago nao deve ser removido.
  if (order.status === "pago") {
    throw new AppError("Pedido pago nao pode ser excluido", 409);
  }

  const [itemsResult, paymentsResult] = await Promise.all([
    OrderItem.deleteMany({ orderId }),
    Payment.deleteMany({ orderId }),
  ]);

  await Order.findByIdAndDelete(orderId);

  await registerLog({
    entity: "orders",
    entityId: orderId,
    action: "delete",
    payload: {
      status: order.status,
      deletedItems: itemsResult.deletedCount || 0,
      deletedPayments: paymentsResult.deletedCount || 0,
    },
    userId,
  });

  cache.invalidate("orders");
  cache.invalidate("reports");

  return { message: "Pedido removido" };
}

module.exports = {
  createOrder,
  listOpenOrders,
  getOrderById,
  addItem,
  updateItem,
  removeItem,
  updateStatus,
  closeOrder,
  deleteOrder,
};
