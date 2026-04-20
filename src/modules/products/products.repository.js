const { Product, OrderItem } = require("../../models");

async function list() {
  return Product.find().populate("categoryId").sort({ name: 1 });
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

async function update(id, data) {
  return Product.findByIdAndUpdate(id, data, { new: true }).populate("categoryId");
}

async function remove(id) {
  return Product.findByIdAndDelete(id);
}

module.exports = { list, findById, findSoldItemByProduct, create, update, remove };
