const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose"); // Corrected typo from 'moongse'
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { type } = require("os");
const { error, log } = require("console");
console.log("--- RUNNING THE LATEST VERSION OF THE CODE ---");

app.use(express.json());
app.use(cors());

// Database connection with MongoDB
mongoose.connect(
  "mongodb+srv://siddhartha_singhal02:siddhartha@cluster0.98jlkgm.mongodb.net/Ecommerce"
);

// API creation
app.get("/", (req, res) => {
  res.send("Express is running");
});

// Image storage engine
// Image storage engine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    // CORRECTED: Removed the () after file.originalname
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// Creating upload endpoint for images
// CORRECTED: The path should be '/images'
app.use("/images", express.static("upload/images"));

// CORRECTED: The path should be '/upload'
// Updated upload endpoint with proper error handling
app.post("/upload", upload.single("product"), (req, res) => {
  try {
    // Check if a file was actually uploaded
    if (!req.file) {
      // This sends a clear error instead of crashing
      return res.status(400).json({
        success: 0,
        message:
          "No file uploaded. Please attach a file under the key 'product'.",
      });
    }

    // If we get here, the file was uploaded successfully
    res.json({
      success: 1,
     image_url: `https://backend-ecommerce-wrcm.onrender.com/images/${req.file.filename}`
      ,
    });
  } catch (error) {
    // This will catch other unexpected errors during the process
    console.error("Error during file upload:", error); // Log the actual error
    res.status(500).json({
      success: 0,
      message: "An internal server error occurred.",
    });
  }
});

//schema for creating products

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
  avilable: {
    type: Boolean,
    default: true,
  },
});
// API for adding a new product
app.post("/addproduct", async (req, res) => {
  try {
    // <-- The 'try' block starts here

    let allProducts = await Product.find({});
    let newId;
    if (allProducts.length > 0) {
      let lastProduct = allProducts[allProducts.length - 1];
      newId = lastProduct.id + 1;
    } else {
      newId = 1;
    }

    const product = new Product({
      id: newId,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    console.log("Saving product:", product);
    await product.save();
    console.log("Product saved successfully.");

    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (error) {
    // <-- The required 'catch' block must follow the 'try'
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

//creating api for deleting memories


app.post('/removeproduct',async (req,res)=>{
     await Product.findOneAndDelete({id:req.body.id});
     console.log("Removed");
     res.json({
        success:true,
        name:req.body.name,
     })
     
})


//creating api for all products

app.get('/allproducts', async (req,res)=>{
       let products = await Product.find({}) ;
       console.log("ALL products fetched");
       res.send(products);
       
})

//schema creating for user model
const Users = mongoose.model('Users',{
  name:{
    type:String,
  },
  email:{
    type:String,
    unique:true
  },
  password:{
    type:String,
  },
  cartData:{
    type:Object,
  },
  date:{
    type:Date,
    default :Date.now(),
  }
})
//creating end point for registring the user
app.post('/signup',async (req,res)=>{
      let check = await Users.findOne({email:req.body.email});
      if(check){
           return res.status(400).json({success:false,errors:"existing users found with email address"})
      }
      let cart = {};
      for (let i = 0; i < 300; i++) {
          cart[i]=0;
        
      }
      const user = new Users({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
      })

      await user.save();

      const data  = {
        user:{
          id:user.id
        }
      }

      const token = jwt.sign(data,'secret_ecom');
      res.json({success:true,token})
})
//creating endpoint for user login
app.post('/login',async (req,res)=>{
      let user = await Users.findOne({email:req.body.email});
      if (user) {
        const passCompare = req.body.password == user.password;
        if (passCompare) {
            const data = {
              user:{
                id:user.id,

              }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token})
        }else{
          res.json({success:false,error:"wrong password"});
          }
          }
          else{
            res.json({success:false,error:"wrong emailid"})
        }
      }
)

//creating end point for new collection data

app.get('/newcollection',async (req,res)=>{
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("New collection fetched");
  res.send(newcollection)
  
} )
//creating end point for popular in women section4
app.get('/popularinwomen',async (req,res)=>{
  let products = await Product.find({category:"Women"});
  let popular_in_women = products.slice(0,4);
  console.log("popular in women fetched");
  res.send(popular_in_women);
  
})

//creating middle wear for fetch user
const fetchUser = async (req,res,next)=>{
  const token = req.header('auth-token');
  if(!token){
    res.status(401).send({errors:"please authinticate using valid token"})
  }else{
       try {
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user ;
            next();
       } catch (error) {
             res.status(401).send({errors:"please authinticate using valid token"})
       }
  }

}

//creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser,async(req,res)=>{
  console.log("added",req.body.itemId);
  let userData = await Users.findOne({_id:req.user.id});
  userData.cartData[req.body.itemId] += 1 ;
  await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
  res.send("Added")

  
})
//creating end point to remove from cartData

app.post('/removefromcart',fetchUser,async (req,res)=>{
  console.log("removed",req.body.itemId);
  
  let userData = await Users.findOne({_id:req.user.id});
  if (userData.cartData[req.body.itemId]>0) {
    userData.cartData[req.body.itemId] -= 1 ;
  }
 
  await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
  res.send("Removed")
})
//creating end point to getcart data
app.get('/getcart',fetchUser,async (req,res)=>{
  console.log("Get cart");
  let userData = await Users.findOne({_id:req.user.id});
   res.json(userData.cartData);
  
})

app.listen(port, (error) => {
  if (!error) {
    console.log("Server is running on port " + port);
  } else {
    console.log("Error" + error);
  }
});
