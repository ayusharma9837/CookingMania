const jwt = require("jsonwebtoken");
const db = require("../config/db");
require("dotenv").config();

const auth = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "No token, authorization denied." });
  }

  try {
    const tokenValue = token.split(" ")[1];

    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);

    req.user = decoded.user;

    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid." });
  }
};

module.exports = auth;
