const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
require("dotenv").config(); // For loading environment variables
const { v2: cloudinary } = require("cloudinary");
const fs = require("fs"); // File system for deleting temp files

console.log("--- RUNNING THE LATEST VERSION OF THE CODE ---");

app.use(express.json());
app.use(cors());

// ------------------- Database Connection -------------------
mongoose.connect(
  "mongodb+srv://siddhartha_singhal02:siddhartha@cluster0.98jlkgm.mongodb.net/Ecommerce"
);

// ------------------- Cloudinary Configuration -------------------
// Make sure to create a .env file with these variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ------------------- Multer Setup for Temporary Storage -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a temporary folder if it doesn't exist
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
    cb(null, "temp/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// ------------------- API Endpoints -------------------

// Root endpoint for testing
app.get("/", (req, res) => {
  res.send("Express Server is Running");
});

// Image Upload Endpoint (uploads to Cloudinary)
app.post("/upload", upload.single("product"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "No file uploaded. Please use the 'product' key.",
      });
    }

    // Upload file from the temporary path to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "ecommerce_products", // Optional: organize uploads in a specific folder
    });

    // Delete the temporary local file after successful upload
    fs.unlinkSync(req.file.path);

    res.json({
      success: 1,
      image_url: result.secure_url, // Send back the secure URL from Cloudinary
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    // If an error occurs, try to delete the temp file anyway
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: 0,
      message: "Image upload failed",
      error: error.message,
    });
  }
});

// ------------------- Mongoose Schemas -------------------

// Product Schema
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true }, // This will now be a Cloudinary URL
  category: { type: String, required: true },
  new_price: { type: Number, required: true },
  old_price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true }, // Corrected spelling from "avilable"
});

// User Schema
const Users = mongoose.model("Users", {
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  cartData: { type: Object },
  date: { type: Date, default: Date.now },
});

// ------------------- Product APIs -------------------

// Add Product
app.post("/addproduct", async (req, res) => {
  try {
    const allProducts = await Product.find({});
    const newId =
      allProducts.length > 0 ? allProducts[allProducts.length - 1].id + 1 : 1;

    const product = new Product({
      id: newId,
      name: req.body.name,
      image: req.body.image, // The Cloudinary URL from the frontend
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    await product.save();
    console.log("Product saved:", req.body.name);
    res.json({ success: true, name: req.body.name });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove Product
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Product removed:", req.body.name);
  res.json({ success: true, name: req.body.name });
});

// Get All Products
app.get("/allproducts", async (req, res) => {
  const products = await Product.find({});
  res.json(products);
});

// Get New Collections
app.get("/newcollection", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("New collection fetched");
  res.send(newcollection);
});

// Get Popular in Women
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "Women" }); // Use lowercase for consistency
  let popular_in_women = products.slice(13, 18);
  console.log("Popular in women fetched");
  res.send(popular_in_women);
});

// ------------------- User & Auth APIs -------------------

// Signup
app.post("/signup", async (req, res) => {
  const check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res
      .status(400)
      .json({ success: false, errors: "User already exists with this email" });
  }

  const cart = {};
  for (let i = 0; i < 300; i++) cart[i] = 0;

  const user = new Users({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = { user: { id: user.id } };
  const token = jwt.sign(data, "secret_ecom"); // Consider moving "secret_ecom" to .env file
  res.json({ success: true, token });
});

// Login
app.post("/login", async (req, res) => {
  const user = await Users.findOne({ email: req.body.email });
  if (!user) {
    return res.json({ success: false, error: "Wrong email" });
  }

  if (req.body.password !== user.password) {
    return res.json({ success: false, error: "Wrong password" });
  }

  const data = { user: { id: user.id } };
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// ------------------- Auth Middleware -------------------
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res
      .status(401)
      .send({ errors: "Please authenticate using a valid token" });
  }

  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch (error) {
    res.status(401).send({ errors: "Invalid or expired token" });
  }
};

// ------------------- Cart APIs -------------------

// Add to Cart
app.post("/addtocart", fetchUser, async (req, res) => {
  const userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added to cart");
});

// Remove from Cart
app.post("/removefromcart", fetchUser, async (req, res) => {
  const userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0) {
    userData.cartData[req.body.itemId] -= 1;
  }
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed from cart");
});

// Get Cart Data
app.get("/getcart", fetchUser, async (req, res) => {
  const userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// ------------------- Server Initialization -------------------
app.listen(port, (error) => {
  if (!error) {
    console.log("Server running on port " + port);
  } else {
    console.log("Error starting server: " + error);
  }
});
