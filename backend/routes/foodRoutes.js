import express from "express";
import Food from "../models/foodModel.js";
import expressAsyncHandler from "express-async-handler";
import { isAdmin, isAuth } from "../utils.js";

const foodRouter = express.Router();

// Get all products API
foodRouter.get("/", async (req, res) => {
  const foods = await Food.find();
  res.send(
    foods.map((food) => ({
      ...food._doc,
      sold: food.sold,
      img: food.img,
    }))
  );
});

// Create a new product API
foodRouter.post(
  "/",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const newFood = new Food({
      name: "sample name " + Date.now(),
      slug: "sample-name-" + Date.now(),
      img: "https://cleverads.vn/blog/wp-content/uploads/2023/10/thi-truong-healthy-food-1.jpg",
      price: 0,
      category: "sample category",
      countInStock: 0,
      rating: 0,
      numReviews: 0,
      description: "sample description",
    });
    const food = await newFood.save();
    res.send({ message: "Food Created", food });
  })
);

// Update product details API
foodRouter.put(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const foodId = req.params.id;
    const food = await Food.findById(foodId);
    if (food) {
      // Update product details
      food.name = req.body.name;
      food.slug = req.body.slug;
      food.price = req.body.price;
      food.img = req.body.img;
      food.imgs = req.body.imgs;
      food.category = req.body.category;
      food.countInStock = req.body.countInStock;
      food.description = req.body.description;
      await food.save();

      res.send({ message: "Food Updated" });
    } else {
      res.status(404).send({ message: "Food Not Found" });
      //check the product
      if (food) {
        await food.remove();
        res.send({ message: "Food Deleted" });
      } else {
        res.status(404).send({ message: "Food Not Found" });
      }
    }
  })
);

// Delete a product API
foodRouter.delete(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const food = await Food.findById(req.params.id);
    if (food) {
      await food.deleteOne();
      res.send({ message: "Food Deleted" });
    } else {
      res.status(404).send({ message: "Food Not Found" });
    }
  })
);

// Create a review for a product API
foodRouter.post(
  "/:id/reviews",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    // Get the foodId from url
    const foodId = req.params.id;
    const food = await Food.findById(foodId);

    // Check if the user has already submitted a review for this food
    if (food) {
      if (food.reviews.find((x) => x.name === req.user.name)) {
        return res
          .status(400)
          .send({ message: "You already submitted a review for this food" });
      }

      // Create a review object
      const review = {
        name: req.user.name,
        avatar: req.user.avatar,
        rating: Number(req.body.rating),
        comment: req.body.comment,
        isAdmin: req.user.isAdmin,
        user: req.user._id,
      };
      food.reviews.push(review); //push the review object

      // Update the numReviews and rating fields
      food.numReviews = food.reviews.length;
      food.rating =
        food.reviews.reduce((a, c) => c.rating + a, 0) /
        food.reviews.length;

      const updatedFood = await food.save(); //save the updated Food
      res.status(201).send({
        message: "Review submitted successfully!",
        review: updatedFood.reviews[updatedFood.reviews.length - 1],
        numReviews: food.numReviews,
        rating: food.rating,
      });
    } else {
      res.status(404).send({ message: "Food Not Found" });
    }
  })
);

// Delete a product review
foodRouter.delete(
  "/:id/reviews/:reviewId",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const foodId = req.params.id;
    const reviewId = req.params.reviewId;

    const food = await Food.findById(foodId);

    const reviewIndex = food.reviews.findIndex((r) => r._id == reviewId);

    if (reviewIndex === -1) {
      res.status(404).send({ message: "Review not found" });
      return;
    }

    const deletedReview = food.reviews.splice(reviewIndex, 1)[0];

    // If product.rating is a single value, handle it differently
    if (typeof food.rating === "number") {
      // Handle the case where product.rating is a single value
      food.rating = calculateAverageRating(food.reviews);
    } else {
      // Remove the corresponding rating from the product's ratings array
      const deletedRatingId = deletedReview.rating; // Assuming the rating ID is stored in the 'rating' field of the review
      food.rating = food.rating.filter((r) => r._id != deletedRatingId);
    }

    // Update numReviews field
    food.numReviews = food.reviews.length;

    await food.save();

    res.send({ message: "Review deleted successfully", food });
  })
);

// Update a product review
foodRouter.put(
  "/:id/reviews/:reviewId",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const foodId = req.params.id;
    const reviewId = req.params.reviewId;

    const food = await Food.findById(foodId);

    const review = food.reviews.find((r) => r._id == reviewId);

    if (!review) {
      res.status(404).send({ message: "Review not found" });
      return;
    }

    // Check if the user editing the review is the same user who created it
    if (review.user.toString() !== req.user._id.toString()) {
      res
        .status(401)
        .send({ message: "You are not authorized to edit this review" });
      return;
    }

    // Update review properties
    review.rating = Number(req.body.rating);
    review.comment = req.body.comment;

    // Update the product's overall rating if needed
    food.rating = calculateAverageRating(food.reviews);

    // Save the updated product
    await food.save();

    res.send({
      message: "Review updated successfully",
      review,
      numReviews: food.numReviews,
      rating: food.rating,
    });
  })
);

// Function to calculate average rating
function calculateAverageRating(reviews) {
  if (reviews.length === 0) {
    return 0;
  }

  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / reviews.length;
}

// Get the list of products for admin (pagination)
const PAGE_SIZE = 9;
foodRouter.get(
  "/admin",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const { query } = req;
    const page = query.page || 1;
    const pageSize = query.pageSize || PAGE_SIZE;

    const foods = await Food.find()
      .skip(pageSize * (page - 1))
      .limit(pageSize);
    const countFoods = await Food.countDocuments();
    res.send({
      foods,
      countFoods,
      page,
      pages: Math.ceil(countFoods / pageSize),
    });
  })
);

// Search for products based on various filters
foodRouter.get(
  "/search",
  expressAsyncHandler(async (req, res) => {
    // Extract query parameters from the request
    const { query } = req;
    const pageSize = query.pageSize || PAGE_SIZE;
    const page = query.page || 1;
    const category = query.category || "";
    const price = query.price || "";
    const rating = query.rating || "";
    const order = query.order || "";
    const searchQuery = query.query || "";

    // Define filters based on query parameters
    const queryFilter =
      searchQuery && searchQuery !== "all"
        ? {
            name: {
              $regex: searchQuery,
              $options: "i",
            },
          }
        : {};
    const categoryFilter = category && category !== "all" ? { category } : {};

    const ratingFilter =
      rating && rating !== "all"
        ? {
            rating: {
              $gte: Number(rating),
            },
          }
        : {};
    const priceFilter =
      price && price !== "all"
        ? {
            // Parse and filter products based on price range
            price: {
              $gte: Number(price.split("-")[0]),
              $lte: Number(price.split("-")[1]),
            },
          }
        : {};

    // Define the sorting order for the retrieved products
    const sortOrder =
      order === "featured"
        ? { featured: -1 }
        : order === "lowest"
        ? { price: 1 }
        : order === "highest"
        ? { price: -1 }
        : order === "toprated"
        ? { rating: -1 }
        : order === "newest"
        ? { createdAt: -1 }
        : { _id: -1 };

    // Query the database to retrieve products based on filters and sorting order
    const foods = await Food.find({
      ...queryFilter,
      ...categoryFilter,
      ...priceFilter,
      ...ratingFilter,
    })
      .sort(sortOrder)
      .skip(pageSize * (page - 1))
      .limit(pageSize);

    // Count the total number of products based on the filters
    const countFoods = await Food.countDocuments({
      ...queryFilter,
      ...categoryFilter,
      ...priceFilter,
      ...ratingFilter,
    });

    // Send the response with the retrieved products, count, and pagination information
    res.send({
      foods,
      countFoods,
      page,
      pages: Math.ceil(countFoods / pageSize),
    });
  })
);

// Get product categories
foodRouter.get(
  "/categories",
  expressAsyncHandler(async (req, res) => {
    const categories = await Food.find().distinct("category");
    res.send(categories);
  })
);



// Get product details by slug
foodRouter.get("/slug/:slug", async (req, res) => {
  const food = await Food.findOne({ slug: { $eq: req.params.slug } })
    .populate({
      path: "reviews.user",
      model: "User",
      select: "_id name avatar isAdmin",
    })
    .exec();

  if (food) {
    res.send(food);
  } else {
    res.status(404).send({ message: "Food not found" });
  }
});

// Get product details by ID
foodRouter.get("/:id", async (req, res) => {
  const food = await Food.findById(req.params.id);
  if (food) {
    res.send(food);
  } else {
    res.status(404).send({ message: "Food not found" });
  }
});

// Get related products by product ID
foodRouter.get(
  "/:id/related",
  expressAsyncHandler(async (req, res) => {
    const food = await Food.findById(req.params.id);

    if (food) {
      // Find related products based on category
      const relatedFoods = await Food.find({
        category: food.category,
        _id: { $ne: food._id }, // Exclude the current product
      }).limit(3); // Adjust the limit as per requirement

      res.send(relatedFoods);
    } else {
      res.status(404).send({ message: "Food not found" });
    }
  })
);

export default foodRouter;
