const { Category } = require("../../models");

async function list() {
  return Category.find().sort({ name: 1 });
}

async function findById(id) {
  return Category.findById(id);
}

async function findByName(name) {
  return Category.findOne({ name });
}

async function create(data) {
  const category = new Category(data);
  return category.save();
}

async function update(id, data) {
  return Category.findByIdAndUpdate(id, data, { returnDocument: "after" });
}

async function remove(id) {
  return Category.findByIdAndDelete(id);
}

module.exports = { list, findById, findByName, create, update, remove };
