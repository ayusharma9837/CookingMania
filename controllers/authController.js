const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const generateToken = (id) => {
  return jwt.sign({ user: { id } }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};


exports.register = async (req, res, next) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ msg: "Please enter all fields." });
  }

  try {
    let [rows] = await db.execute("SELECT user_id FROM Users WHERE email = ?", [
      email,
    ]);
    if (rows.length > 0) {
      return res.status(400).json({ msg: "User already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await db.execute(
      "INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, password_hash]
    );
    const user_id = result.insertId;

    const token = generateToken(user_id);

    res.status(201).json({
      token,
      user: { id: user_id, username, email },
    });
  } catch (err) {
    console.error(err.message);
    next(err);
  }
};


exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Please enter all fields." });
  }

  try {
    const [rows] = await db.execute(
      "SELECT user_id, username, email, password_hash FROM Users WHERE email = ?",
      [email]
    );
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials." });
    }

    const token = generateToken(user.user_id);

    res.json({
      token,
      user: { id: user.user_id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error(err.message);
    next(err);
  }
};


exports.getMe = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      "SELECT user_id, username, email FROM Users WHERE user_id = ?",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ msg: "User not found." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    next(err);
  }
};
