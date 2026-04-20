const { AppError } = require("../../common/AppError");
const { ORDER_STATUS_FLOW } = require("../../common/constants");
const { registerLog } = require("../../common/logService");
const repository = require("./orders.repository");

function generatePublicId() {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PED-${ymd}-${suffix}`;
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
  const order = await repository.createOrder({
    publicId: generatePublicId(),
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress,
    tableNumber: data.tableNumber,
    type: data.type,
    notes: data.notes,
    createdById: userId,
    status: "aberto",
  });

  await registerLog({ entity: "orders", entityId: order.id, action: "create", payload: order, userId });
  return order;
}

async function listOpenOrders() {
  return repository.getOpenOrders();
}

async function getOrderById(id) {
  const order = await repository.findOrderById(id);
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  return order;
}

async function addItem(orderId, data, userId) {
  const order = await repository.findOrderById(orderId);
  await ensureOrderEditable(order);

  const product = await repository.findProductById(data.productId);
  if (!product || !product.active) {
    throw new AppError("Produto nao encontrado ou inativo", 404);
  }

  const unitPrice = Number(data.unitPrice ?? product.price);
  const total = Number((unitPrice * data.quantity).toFixed(2));

  const item = await repository.createItem({
    orderId,
    productId: product.id,
    productName: product.name,
    quantity: data.quantity,
    unitPrice,
    total,
    notes: data.notes,
    accompaniment: data.accompaniment,
    extras: data.extras,
    priceChangedById: data.unitPrice ? userId : null,
  });

  const updatedOrder = await recalcOrder(orderId);

  await registerLog({
    entity: "order_items",
    entityId: item.id,
    action: "create",
    payload: { ...item, changedPrice: Boolean(data.unitPrice) },
    userId,
  });

  return updatedOrder;
}

async function updateItem(orderId, itemId, data, userId) {
  const order = await repository.findOrderById(orderId);
  await ensureOrderEditable(order);

  const item = await repository.findItemById(itemId);
  if (!item || item.orderId !== orderId) {
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

  await repository.updateItem(itemId, payload);
  const updatedOrder = await recalcOrder(orderId);

  await registerLog({ entity: "order_items", entityId: itemId, action: "update", payload, userId });
  return updatedOrder;
}

async function removeItem(orderId, itemId, userId) {
  const order = await repository.findOrderById(orderId);
  await ensureOrderEditable(order);

  const item = await repository.findItemById(itemId);
  if (!item || item.orderId !== orderId) {
    throw new AppError("Item nao encontrado", 404);
  }

  await repository.removeItem(itemId);
  const updatedOrder = await recalcOrder(orderId);

  await registerLog({ entity: "order_items", entityId: itemId, action: "delete", payload: item, userId });
  return updatedOrder;
}

async function recalcOrder(orderId, discount = undefined, deliveryFee = undefined) {
  const order = await repository.findOrderById(orderId);
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  const discountValue = discount !== undefined ? Number(discount) : Number(order.discount);
  const deliveryValue = deliveryFee !== undefined ? Number(deliveryFee) : Number(order.deliveryFee);
  const totals = calcTotals(order.items, discountValue, deliveryValue);

  return repository.updateOrder(orderId, {
    subtotal: totals.subtotal,
    discount: discountValue,
    deliveryFee: deliveryValue,
    total: totals.total,
  });
}

async function updateStatus(orderId, status, reason, userId) {
  const order = await repository.findOrderById(orderId);
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

  const updated = await repository.updateOrder(orderId, payload);

  await registerLog({
    entity: "orders",
    entityId: orderId,
    action: status === "cancelado" ? "cancel" : "status_update",
    payload: { oldStatus: order.status, status, reason },
    userId,
  });

  return updated;
}

async function closeOrder(orderId, data, userId) {
  const order = await repository.findOrderById(orderId);
  if (!order) {
    throw new AppError("Pedido nao encontrado", 404);
  }

  if (order.status === "pago") {
    throw new AppError("Pedido ja pago", 409);
  }

  if (order.items.length === 0) {
    throw new AppError("Pedido sem itens nao pode ser fechado", 400);
  }

  const updatedOrder = await recalcOrder(orderId, data.discount, data.deliveryFee);

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

  await repository.prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId,
        method: data.paymentMethod,
        amount: total,
        cashAmount: cashAmount || null,
        pixAmount: pixAmount || null,
        cardAmount: cardAmount || null,
        registeredById: userId,
      },
    });

    const items = await tx.orderItem.findMany({ where: { orderId } });

    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      const recipe = await tx.recipeItem.findMany({ where: { productId: item.productId } });
      for (const recipeItem of recipe) {
        const toDecrease = Number(recipeItem.quantity) * item.quantity;
        // eslint-disable-next-line no-await-in-loop
        const ingredient = await tx.ingredient.findUnique({ where: { id: recipeItem.ingredientId } });

        if (!ingredient) {
          throw new AppError("Ingrediente da receita nao encontrado", 404);
        }

        if (Number(ingredient.currentStock) < toDecrease) {
          throw new AppError(`Estoque insuficiente para ${ingredient.name}`, 409);
        }

        // eslint-disable-next-line no-await-in-loop
        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: { currentStock: Number(ingredient.currentStock) - toDecrease },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "pago",
        closedAt: new Date(),
        paidAt: new Date(),
      },
    });
  });

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

  return repository.findOrderById(orderId);
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
};
