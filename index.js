// ---------------------- Imports ----------------------
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const http = require("http");
const session = require("express-session");

// ---------------------- App Setup ----------------------
const app = express();
const port = 3000;

// Wrap Express in HTTP server for Socket.IO
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Middleware
app.use(express.static(__dirname)); // Serve HTML/CSS/JS
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "football-secret-key",
    resave: false,
    saveUninitialized: false,
  }),
);

// ---------------------- Local MongoDB Connection ----------------------
const localUri = "mongodb://localhost:27017";
const client = new MongoClient(localUri);

let usersCollection;
let adminsCollection;

client
  .connect()
  .then(() => {
    const db = client.db("football_signup");
    usersCollection = db.collection("users");
    adminsCollection = db.collection("admins");
    console.log("Connected to local MongoDB");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// ---------------------- Socket.IO ----------------------
io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});

// ---------------------- Routes ----------------------

// Test route
app.get("/", (req, res) => {
  res.send("Football Signup Server is running!");
});

// Serve HTML pages
app.get("/login", (req, res) => res.sendFile(__dirname + "/login.html"));
app.get("/signup", (req, res) => res.sendFile(__dirname + "/signup.html"));
app.get("/admin", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/login");
  }

  res.sendFile(__dirname + "/admin.html");
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }

    // Check if admin exists
    const admin = await adminsCollection.findOne({ username, password });

    if (!admin) {
      return res.status(401).send("Invalid credentials");
    }

    req.session.admin = admin;
    res.redirect("/admin");
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send("Error during login");
  }
});

// Invitation page
app.get("/invitation", (req, res) => {
  res.sendFile(__dirname + "/invitation.html");
});

// ---------------------- CRUD Routes ----------------------

// CREATE - Signup
app.post("/signup", async (req, res) => {
  try {
    const { fullname, email, phone } = req.body;

    if (!fullname || !email || !phone) {
      return res.status(400).send("All fields are required.");
    }

    // Check duplicate email
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).send("Email already registered");
    }

    const user = { fullname, email, phone, createdAt: new Date() };

    await usersCollection.insertOne(user);

    // Emit live event
    io.emit("newUser", user);

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
    const search = req.query.search || "";
    const sortOrder = req.query.sort === "asc" ? 1 : -1;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { fullname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    const total = await usersCollection.countDocuments(query);

    const users = await usersCollection
      .find(query)
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({ users, total });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
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
      { $set: updateData },
    );

    if (result.modifiedCount) {
      io.emit("updateUser", { email, ...updateData });
      res.send("User updated");
    } else {
      res.send("No user found");
    }
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

    if (result.deletedCount) {
      io.emit("deleteUser", email);
      res.send("User deleted");
    } else {
      res.send("No user found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
  }
});

// ---------------------- Start Server ----------------------
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
