const { z } = require("zod");

const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    categoryId: z.string().min(1),
    price: z.number().positive(),
    description: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    categoryId: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    description: z.string().nullable().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

const productIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

module.exports = { createProductSchema, updateProductSchema, productIdSchema };
