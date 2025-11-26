const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const errorHandler = require("./middleware/error");

const authRoutes = require("./routes/auth");
const recipeRoutes = require("./routes/recipes");
const userRoutes = require("./routes/users");
const ingredientRoutes = require("./routes/ingredients");

const app = express();

// Final safe CORS setup
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// REMOVE THIS LINE (breaks Express 5)
// app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ingredients", ingredientRoutes);

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "API Endpoint Not Found",
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    ` Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`
  );
});
