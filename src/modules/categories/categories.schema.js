const { z } = require("zod");

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2),
    active: z.boolean().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}),
});

const categoryIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

module.exports = { createCategorySchema, updateCategorySchema, categoryIdSchema };
