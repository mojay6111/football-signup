// ---------------------- Imports ----------------------
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");

// ---------------------- App Setup ----------------------
const app = express();
const port = 3000;

// Middleware
app.use(express.static(__dirname)); // Serve HTML/CSS/JS
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---------------------- Local MongoDB Connection ----------------------
const localUri = "mongodb://localhost:27017";
const client = new MongoClient(localUri);

let usersCollection;

client
  .connect()
  .then(() => {
    const db = client.db("football_signup");
    usersCollection = db.collection("users");
    console.log("Connected to local MongoDB");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// ---------------------- Routes ----------------------

// Test route
app.get("/", (req, res) => {
  res.send("Football Signup Server is running!");
});

// Serve HTML pages
app.get("/signup", (req, res) => res.sendFile(__dirname + "/signup.html"));
app.get("/admin", (req, res) => res.sendFile(__dirname + "/admin.html"));

// Invitation page
app.get("/invitation", (req, res) => {
  res.send(
    "<h1>Welcome to the Football Match!</h1><p>Thank you for signing up.</p>"
  );
});

// ---------------------- CRUD Routes ----------------------

// CREATE - Signup
app.post("/signup", async (req, res) => {
  try {
    const { fullname, email, phone } = req.body;

    if (!fullname || !email || !phone) {
      return res.status(400).send("All fields are required.");
    }

    // Check for duplicate email
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).send("Email already registered");
    }

    const user = { fullname, email, phone, createdAt: new Date() };

    await usersCollection.insertOne(user);

    console.log("New user inserted:", email);
    res.redirect("/invitation");
  } catch (err) {
    console.error("Error inserting user:", err);
    res.status(500).send("Error saving user");
  }
});

// READ - Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users.");
  }
});

// UPDATE - Update user by email
app.put("/users", async (req, res) => {
  try {
    const { email, fullname, phone } = req.body;
    if (!email) return res.status(400).send("Email is required");

    const updateData = {};
    if (fullname) updateData.fullname = fullname;
    if (phone) updateData.phone = phone;

    const result = await usersCollection.updateOne(
      { email },
      { $set: updateData }
    );

    res.send(result.modifiedCount ? "User updated" : "No user found");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating user");
  }
});

// DELETE - Delete user by email
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

// ---------------------- Start Server ----------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
