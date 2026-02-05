// Import required modules
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");

// Create Express app
const app = express();
const port = 3000;

// Serve static files (CSS, JS, HTML if needed)
app.use(express.static(__dirname));

// Middleware to parse JSON and form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MongoDB connection URL
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

// Connect to database
let usersCollection;

client
  .connect()
  .then(() => {
    const db = client.db("football_signup");
    usersCollection = db.collection("users");
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error(err));

// Simple route to check server
app.get("/", (req, res) => {
  res.send("Football Signup Server is running!");
});

// Start server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

app.get("/signup", (req, res) => {
  res.sendFile(__dirname + "/signup.html");
});

app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/admin.html");
});

// Route to handle signup form submission
app.post("/signup", async (req, res) => {
  try {
    const { fullname, email, phone } = req.body;

    if (!fullname || !email || !phone) {
      return res.status(400).send("All fields are required.");
    }

    // Check if email already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).send("Email already registered");
    }

    // Insert user
    const result = await usersCollection.insertOne({
      fullname,
      email,
      phone,
      createdAt: new Date(),
    });

    console.log("New user inserted:", result.insertedId);
    res.redirect("/invitation");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving user.");
  }
});

// Invitation page
app.get("/invitation", (req, res) => {
  res.send(
    "<h1>Welcome to the Football Match!</h1><p>Thank you for signing up.</p>",
  );
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users); // returns JSON array of users
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users.");
  }
});

// Update user by email
app.put("/users", async (req, res) => {
  try {
    const { email, fullname, phone } = req.body;

    if (!email) return res.status(400).send("Email is required");

    const updateData = {};
    if (fullname) updateData.fullname = fullname;
    if (phone) updateData.phone = phone;

    const result = await usersCollection.updateOne(
      { email },
      { $set: updateData },
    );

    res.send(result.modifiedCount ? "User updated" : "No user found");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating user");
  }
});

// Delete user by email
app.delete("/users", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send("Email is required");

    const result = await usersCollection.deleteOne({ email });
    res.send(result.deletedCount ? "User deleted" : "No user found");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
  }
});
