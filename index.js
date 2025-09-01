const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
require("dotenv").config();
const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");

console.log("--- RUNNING THE LATEST VERSION OF THE CODE ---");

app.use(express.json());
app.use(cors());

// ------------------- Database -------------------
mongoose.connect(
  "mongodb+srv://siddhartha_singhal02:siddhartha@cluster0.98jlkgm.mongodb.net/Ecommerce"
);

// ------------------- Cloudinary -------------------
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ------------------- Multer setup -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "temp/"); // Temporary folder
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage: storage });

// ------------------- Upload Endpoint -------------------
app.post("/upload", upload.single("product"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "No file uploaded. Use key 'product'.",
      });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "ecommerce_products",
    });

    // Delete local temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: 1,
      image_url: result.secure_url,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({
      success: 0,
      message: "Image upload failed",
      error: error.message,
    });
  }
});

// ------------------- Product Schema -------------------
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true }, // Cloudinary URL
  category: { type: String, required: true },
  new_price: { type: Number, required: true },
  old_price: { type: Number, required: true },
  date: { type: Date, default: Date.now() },
  avilable: { type: Boolean, default: true },
});

// ------------------- Add Product -------------------
app.post("/addproduct", async (req, res) => {
  try {
    const allProducts = await Product.find({});
    const newId = allProducts.length > 0 ? allProducts[allProducts.length - 1].id + 1 : 1;

    const product = new Product({
      id: newId,
      name: req.body.name,
      image: req.body.image, // Cloudinary URL
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    await product.save();

    res.json({ success: true, name: req.body.name });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------- Remove Product -------------------
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  res.json({ success: true, name: req.body.name });
});

// ------------------- Get All Products -------------------
app.get("/allproducts", async (req, res) => {
  const products = await Product.find({});
  res.json(products);
});

// ------------------- Users Schema -------------------
const Users = mongoose.model("Users", {
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  cartData: { type: Object },
  date: { type: Date, default: Date.now() },
});

// ------------------- Signup -------------------
app.post("/signup", async (req, res) => {
  const check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, errors: "User already exists" });
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
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// ------------------- Login -------------------
app.post("/login", async (req, res) => {
  const user = await Users.findOne({ email: req.body.email });
  if (!user) return res.json({ success: false, error: "Wrong email" });

  if (req.body.password != user.password)
    return res.json({ success: false, error: "Wrong password" });

  const data = { user: { id: user.id } };
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// ------------------- Auth Middleware -------------------
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errors: "Authenticate with token" });

  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch {
    res.status(401).send({ errors: "Authenticate with token" });
  }
};

// ------------------- Cart APIs -------------------
app.post("/addtocart", fetchUser, async (req, res) => {
  const userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Added");
});

app.post("/removefromcart", fetchUser, async (req, res) => {
  const userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0) userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Removed");
});

app.get("/getcart", fetchUser, async (req, res) => {
  const userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// ------------------- Server -------------------
app.listen(port, (error) => {
  if (!error) console.log("Server running on port " + port);
  else console.log("Error: " + error);
});
