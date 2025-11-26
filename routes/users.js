const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

router.post("/favorites/:recipeId", userController.toggleFavorite);

router.get("/favorites", userController.getFavorites);

router.get("/suggestions", userController.getPersonalizedSuggestions);

router.put("/preferences", userController.updatePreferences);

module.exports = router;
