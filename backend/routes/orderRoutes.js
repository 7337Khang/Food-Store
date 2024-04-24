import express from "express";
import expressAsyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import Food from "../models/foodModel.js";
import nodemailer from "nodemailer";
import {
  isAuth,
  isAdmin,
  payOrderEmailTemplate,
  deliverOrderEmailTemplate,
} from "../utils.js";
import mongoose from "mongoose";

const orderRouter = express.Router();
//isAuth first, isAdmin second

// Get order list (for admin)
orderRouter.get(
  "/",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const userId = mongoose.Types.ObjectId("admin user");
    const orders = await Order.find({ user: userId }).populate("user", "name");
    res.send(orders);
  })
);

// Create a new order
orderRouter.post(
  "/",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    // Create a new order instance
    const newOrder = new Order({
      orderItems: req.body.orderItems.map((x) => ({ ...x, food: x._id })),
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      itemsPrice: req.body.itemsPrice,
      shippingPrice: req.body.shippingPrice,
      taxPrice: req.body.taxPrice,
      totalPrice: req.body.totalPrice,
      user: req.user._id,
    });

    // Save the new order
    const order = await newOrder.save();

    // Update product sold count for each item in the order
    for (const item of order.orderItems) {
      const food = await Food.findById(item.food);
      if (food) {
        food.sold += item.quantity;
        await food.save();
      }
    }
    res.status(201).send({ message: "New Order Created", order });
  })
);

// Get summary data for admin dashboard (chart)
orderRouter.get(
  "/summary",
  isAuth,
  isAdmin,
  // Aggregations to get summary data
  expressAsyncHandler(async (req, res) => {
    // Aggregate to get the total number of orders and total sales
    const orders = await Order.aggregate([
      {
        $group: {
          _id: null, // Group by null to get overall summary
          numOrders: { $sum: 1 }, // Count the number of orders
          totalSales: { $sum: "$totalPrice" }, // Sum up total sales
        },
      },
    ]);

    // Aggregate to get the total number of users
    const users = await User.aggregate([
      {
        $group: {
          _id: null,
          numUsers: { $sum: 1 }, // Count the number of users
        },
      },
    ]);

    // Aggregate to get daily orders and sales
    const dailyOrders = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 }, // Count daily orders
          sales: { $sum: "$totalPrice" }, // Sum up daily sales
        },
      },
      { $sort: { _id: 1 } }, // Sort results by date
    ]);

    console.log(dailyOrders);

    // Aggregate to get the count of products in each category
    const foodCategories = await Food.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }, // Count products in each category
        },
      },
    ]);

    // Aggregate to get details about products sold
    const foodSold = await Food.aggregate([
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          img: { $first: "$img" },
          quantitySold: { $sum: "$sold" }, // Sum up quantity sold for each product
        },
      },
    ]);

    // Aggregate to get user-wise order quantity
    const userOrderQuantity = await Order.aggregate([
      {
        $group: {
          _id: "$user",
          name: { $first: "$user.name" },
          quantityOrdered: { $sum: 1 }, // Count orders placed by each user
        },
      },
      {
        $lookup: {
          from: "users", // Assuming users collection is named "users"
          localField: "_id",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $addFields: {
          user: { $arrayElemAt: ["$userData", 0] },
        },
      },
      {
        $project: {
          _id: "$user._id",
          name: "$user.name",
          quantityOrdered: 1,
        },
      },
    ]);

    // Aggregate to get user-wise total spending
    const userSpending = await Order.aggregate([
      {
        $group: {
          _id: "$user",
          name: { $first: "$user.name" },
          totalSpending: { $sum: "$totalPrice" }, // Sum up total spending for each user
        },
      },
      {
        $lookup: {
          from: "users", // Assuming users collection is named "users"
          localField: "_id",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $addFields: {
          user: { $arrayElemAt: ["$userData", 0] },
        },
      },
      {
        $project: {
          _id: "$user._id",
          name: "$user.name",
          totalSpending: 1,
        },
      },
    ]);

    // Send the aggregated data as the response
    res.send({
      users,
      orders,
      dailyOrders,
      foodCategories,
      foodSold,
      userOrderQuantity,
      userSpending,
    });
  })
);

// get order history api
// orderRouter.get(
//   "/mine",
//   isAuth,
//   expressAsyncHandler(async (req, res) => {
//     const orders = await Order.find({ user: req.user._id });
//     res.send(orders);
//   })
// );

// Get order history for a user
orderRouter.get(
  "/mine",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 8;

    try {
      const orders = await Order.find({ user: req.user._id })
        .skip(pageSize * (page - 1))
        .limit(pageSize)
        .populate("user", "name");
      const countOrders = await Order.countDocuments({ user: req.user._id });

      res.send({
        orders,
        countOrders,
        page,
        pages: Math.ceil(countOrders / pageSize),
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  })
);

// Get order list for admin
orderRouter.get(
  "/admin",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Get page from query string
    const pageSize = 10; // Set page size
    try {
      const orders = await Order.find()
        .skip(pageSize * (page - 1))
        .limit(pageSize)
        .populate("user", "name");
      const countOrders = await Order.countDocuments();

      res.send({
        orders,
        countOrders,
        page,
        pages: Math.ceil(countOrders / pageSize),
      });
    } catch (error) {
      res.status(500).send({ message: "Internal Server Error" });
    }
  })
);

// Get details of a specific order
orderRouter.get(
  "/:id",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      res.send(order);
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

// Update order status to delivered
orderRouter.put(
  "/:id/deliver",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "email name"
    );

    // check if the order exists
    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();

      await order.save();

      // Sending delivery confirmation email using Nodemailer
      const transport = nodemailer.createTransport({
        // Configure email service provider details
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.USER,
          pass: process.env.APP_PASSWORD,
        },
      });

      transport.verify(function (error, success) {
        if (error) {
          console.log(error);
        } else {
          console.log("Server is ready to take our messages");
        }
      });

      const mailOptions = {
        from: {
          name: "Food Store",
          address: process.env.USER,
        },
        to: `${order.user.name} <${order.user.email}>`,
        subject: `Order Delivered - Order ${order._id}`,
        text: "Your order is delivering. Thank you for shopping with us!",
        html: deliverOrderEmailTemplate(order),
        attachments: order.orderItems.map((item) => ({
          filename: `${item.name}.jpg`,
          path: item.img,
          contentType: "image/jpg",
        })),
      };

      transport.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
        } else {
          console.log(`Email sent: ${info.response}`);
        }
      });

      res.send({ message: "Order Is Delivering" });
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

// Update order status to paid
orderRouter.put(
  "/:id/pay",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "email name avatar"
    );

    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: req.body.email_address,
      };

      // Update countInStock and sold for each product in the order
      for (const orderItem of order.orderItems) {
        const food = await Food.findById(orderItem.food);

        if (food) {
          // Update countInStock and sold
          food.countInStock -= orderItem.quantity;
          food.sold += orderItem.quantity;
          await food.save();
        }
      }

      const updatedOrder = await order.save();

      // Sending payment confirmation email using Nodemailer
      const transport = nodemailer.createTransport({
        // Configure email service provider details
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.USER,
          pass: process.env.APP_PASSWORD,
        },
      });

      transport.verify(function (error, success) {
        if (error) {
          console.log(error);
        } else {
          console.log("Server is ready to take our messages");
        }
      });

      const mailOptions = {
        from: {
          name: "Food Store",
          address: process.env.USER,
        },
        to: `${order.user.name} <${order.user.email}>`,
        subject: `Payment Confirmation - Order ${order._id}`,
        text: "Thanks for using our service !!",
        html: payOrderEmailTemplate(order),
        attachments: order.orderItems.map((item) => ({
          filename: `${item.name}.jpg`,
          path: item.img,
          contentType: "image/jpg",
        })),
      };

      transport.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
        } else {
          console.log(`Email sent: ${info.response}`);
        }
      });

      res.send({ message: "Order Paid", order: updatedOrder });
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

// Delete an order
orderRouter.delete(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    //check if order exists
    if (order) {
      await order.deleteOne();
      res.send({ message: "Order Deleted" });
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

export default orderRouter;
