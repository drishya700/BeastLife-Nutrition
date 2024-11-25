const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();

const secretKey = 'mysecretkey';

app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/beastlife').then(()=>{
    console.log("Connected to Mongo")
})

// Define User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    cart: [{
        productId: mongoose.Schema.Types.ObjectId,
        quantity: Number
    }]
});

const User = mongoose.model('User', userSchema);

// Add this to your server.js file

// Define Product Schema with updated fields
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 999.0 }, // Price as float
    description: { type: String, required: false },
    image: { type: String, required: false }, 
    reviews: { type: Number, default: 0 } 
});

const Product = mongoose.model('Product', productSchema);

// // Create some sample products (Run this once to add products)
// const createProducts = async () => {
//     const products = [
//         { name: 'Whey-Gold with Ultrasorb Tech | 1848G', price: 3299, description: '', image: 'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Whey%20Protein.jpg' },
//         { name: 'BeastLife Blend Pro Sipper with Straw | 1000ML', price: 899, description: '', image: 'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Sipper.png' },
//         { name: 'Daily Multivitamin 90 Tablets', price: 999, description: '', image: 'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Multivitamin.jpg' },
//         { name: 'Ayurveda for Performance Ashwagandha', price: 899, description: '', image: 'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Ashwagandha.jpg' },
//         { name: 'Creatine + Pre-Workout(500mg Caffeine)', price: 1049, description: '', image: 'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/creatine.jpg' },
//         { name: 'Vegan Protein', price: 2999, description: '', image: 'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Vegan_Protein.jpg' },
//         {name: 'Omega 3 Fish Oil with 180mg EPA and 120mg DHA', price: 699, description: '', image:'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Fish_Oil.jpg' },
//         {name: 'Super Micronized Creatine Monohydrate', price: 1199, description: '', image:'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Micronized_Monohydrate.png' },
//         {name: 'Isorich Blend Whey Protein with Ultrasorb Tech | 924G', price: 3499,description: '', image:'https://raw.githubusercontent.com/drishya700/BeastLife-Nutrition/refs/heads/master/Beastlife%20Nutrition/assets/images/Isorich_Blend_Whey.png' }

//     ];

//     await Product.insertMany(products);
//     console.log('Products added');
// };


// createProducts();


// Fetch all products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products' });
    }
});


// Signup API
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword, cart: [] });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Error registering user' });
    }
});

// Login API
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, secretKey);
        res.json({ token });
    } catch (error) {
        res.status(400).json({ message: 'Error logging in' });
    }
});

// Middleware to verify JWT token
const authenticate = (req, res, next) => {
    // Get the authorization header
    const authHeader = req.headers['authorization'];
    
    // Check if the header is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Extract the token part from 'Bearer <token>'
    const token = authHeader.split(' ')[1];

    // Verify the token
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            console.error('Token verification error:', err.message); // Log any errors during verification
            return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = user;
        next();
    });
};

// Fetch products by IDs
app.post('/products', async (req, res) => {
    const { productIds } = req.body;
    try {
        const products = await Product.find({ '_id': { $in: productIds } });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products' });
    }
});


// Add to Cart API
app.post('/cart', authenticate, async (req, res) => {
    const { productId, quantity } = req.body;
    console.log('Received productId:', productId);
    console.log('Received quantity:', quantity);
    console.log('User ID:', req.user.id);

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert productId to ObjectId
        const productObjectId = new mongoose.Types.ObjectId(productId);

        const existingProduct = user.cart.find(item => item.productId.toString() === productObjectId.toString());

        if (existingProduct) {
            existingProduct.quantity += quantity;
        } else {
            user.cart.push({ productId: productObjectId, quantity });
        }

        await user.save();
        res.json({ message: 'Product added to cart', cart: user.cart });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(400).json({ message: 'Error adding to cart' });
    }
});

// Get Cart API
app.get('/cart', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('cart.productId');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const cart = user.cart.map(item => ({
            productId: item.productId._id, // If you want the product's ID
            quantity: item.quantity
        }));

        res.json({ username: user.username, cart });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(400).json({ message: 'Error fetching cart' });
    }
});



// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
