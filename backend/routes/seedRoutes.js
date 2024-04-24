import express from "express";
// import data from "../data.js";
import User from "../models/userModel.js";
import Food from "../models/foodModel.js";

const seedRouter = express.Router();
// get data and send to FE
seedRouter.get("/", async (req, res) => {
  //get for product
  await Food.deleteMany({});
  const createdFoods = await Food.insertMany(data.foods);

  //get for user
  await User.deleteMany({});
  const createdUsers = await User.insertMany(data.users);

  res.send({ createdFoods, createdUsers });
});

export default seedRouter;
