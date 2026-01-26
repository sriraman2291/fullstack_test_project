const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const RefreshToken = require("./models/RefreshToken");
const bcrypt = require("bcrypt");
const User = require("./models/User");
require("dotenv").config();

const app = express();

app.use(express.json());   // ✅ REQUIRED

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://super-fairy-03a182.netlify.app"
  ],
  credentials: true
}));


// 🔐 Secrets (use .env in real projects)
const ACCESS_SECRET = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT secrets missing");
}


// 👤 Dummy user
const user = {
  id: 1,
  username: "testuser",
  password: "Test@123"
};

// 🔌 MongoDB connection (STEP 3 CONFUSION SOLVED HERE)
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));


/* =========================
   LOGIN API
========================= */
app.post("/api/login", async (req, res) => {

  console.log("LOGIN BODY:", req.body);

  const { username, password } = req.body;

  const user = await User.findOne({ username });

  console.log("USER FOUND:", user?._id);
  
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const accessToken = jwt.sign(
    { userId: user._id },
    ACCESS_SECRET,
    { expiresIn: "30s" }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    REFRESH_SECRET,
    { expiresIn: "1d" }
  );

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken
  });

  res.json({ accessToken, refreshToken });
});


/* =========================
   REFRESH TOKEN (ROTATION)
========================= */
app.post("/api/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(401);

  const tokenFromDb = await RefreshToken.findOne({ token: refreshToken });
  if (!tokenFromDb) return res.sendStatus(403);

  jwt.verify(refreshToken, REFRESH_SECRET, async (err, decoded) => {
    if (err) return res.sendStatus(403);

    // 🔥 delete old refresh token
    await RefreshToken.deleteOne({ token: refreshToken });

    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      ACCESS_SECRET,
      { expiresIn: "30s" }
    );

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId },
      REFRESH_SECRET,
      { expiresIn: "1d" }
    );

    await RefreshToken.create({
      userId: decoded.userId,
      token: newRefreshToken
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  });
});

/* =========================
   LOGOUT
========================= */
app.post("/api/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(400);

  await RefreshToken.deleteOne({ token: refreshToken });
  res.json({ message: "Logged out successfully" });
});

/* =========================
   ACCESS TOKEN VERIFY
========================= */
function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];
  jwt.verify(token, ACCESS_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

/* =========================
   PROTECTED API
========================= */
app.get("/api/profile", verifyAccessToken, (req, res) => {
  res.json({
    message: "Profile data",
    userId: req.user.userId
  });
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


/* =========================
   REGISTER API
========================= */
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password required"
    });
  }

  // Check if user exists
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(409).json({
      message: "User already exists"
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Save user
  await User.create({
    username,
    password: hashedPassword
  });

  res.status(201).json({
    message: "User registered successfully"
  });
});


/* =========================
   DELETE USER
========================= */
app.delete("/api/user", verifyAccessToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Delete all refresh tokens for this user
    await RefreshToken.deleteMany({ userId });

    res.status(200).json({
      message: "User account deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete user"
    });
  }
});
