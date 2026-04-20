const { z } = require("zod");

const orderTypes = ["mesa", "balcao", "retirada", "delivery"];
const orderStatus = [
  "aberto",
  "enviado_cozinha",
  "preparando",
  "pronto",
  "saiu_entrega",
  "entregue",
  "pago",
  "cancelado",
];
const paymentMethods = ["dinheiro", "pix", "cartao", "misto"];

const createOrderSchema = z.object({
  body: z.object({
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerAddress: z.string().optional(),
    tableNumber: z.string().optional(),
    type: z.enum(orderTypes),
    notes: z.string().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const listOrdersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    status: z.enum(["aberto", "pago", "cancelado"]).optional(),
    type: z.enum(["retirada", "delivery"]).optional(),
    tipy: z.enum(["retirada", "delivery"]).optional(),
  }),
});

const orderIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

const addItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive().optional(),
    notes: z.string().optional(),
    accompaniment: z.string().optional(),
    extras: z.string().optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

const updateItemSchema = z.object({
  body: z.object({
    quantity: z.number().int().positive().optional(),
    unitPrice: z.number().positive().optional(),
    notes: z.string().optional(),
    accompaniment: z.string().optional(),
    extras: z.string().optional(),
  }),
  params: z.object({ id: z.string().min(1), itemId: z.string().min(1) }),
  query: z.object({}),
});

const itemIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().min(1), itemId: z.string().min(1) }),
  query: z.object({}),
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(orderStatus),
    reason: z.string().optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

const closeOrderSchema = z.object({
  body: z.object({
    discount: z.number().nonnegative().default(0),
    deliveryFee: z.number().nonnegative().default(0),
    paymentMethod: z.enum(paymentMethods),
    cashAmount: z.number().nonnegative().optional(),
    pixAmount: z.number().nonnegative().optional(),
    cardAmount: z.number().nonnegative().optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

module.exports = {
  createOrderSchema,
  listOrdersSchema,
  orderIdSchema,
  addItemSchema,
  updateItemSchema,
  itemIdSchema,
  updateStatusSchema,
  closeOrderSchema,
};
