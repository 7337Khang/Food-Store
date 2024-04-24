import mongoose from "mongoose";

// Define the review schema
const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    comment: { type: String },
    rating: { type: Number, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the "User" model
      required: true,
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt timestamps
  }
);

// Define the Food schema
const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    img: { type: String, required: true },
    imgs: [String],
    category: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    countInStock: { type: Number, required: true },
    sold: {
      type: Number,
      default: 0,
    },
    rating: { type: Number, required: true },
    numReviews: { type: Number, required: true },
    reviews: [reviewSchema], // Array of review objects based on the reviewSchema
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt timestamps
  }
);

// Create the Food model using the foodSchema
const Food = mongoose.model("Food", foodSchema);

export default Food;
