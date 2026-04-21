const { Product, OrderItem } = require("../../models");

async function list() {
  return Product.find().populate("categoryId").sort({ active: -1, name: 1 });
}

async function findById(id) {
  return Product.findById(id);
}

async function findSoldItemByProduct(id) {
  return OrderItem.findOne({ productId: id });
}

async function create(data) {
  const product = new Product(data);
  return product.save();
}

async function createMany(items) {
  return Product.insertMany(items, { ordered: true });
}

async function update(id, data) {
  return Product.findByIdAndUpdate(id, data, { returnDocument: "after" }).populate("categoryId");
}

async function remove(id) {
  return Product.findByIdAndDelete(id);
}

module.exports = { list, findById, findSoldItemByProduct, create, createMany, update, remove };
