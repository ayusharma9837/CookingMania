const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");
const authMiddleware = require("../middleware/auth");

router.get("/", recipeController.getAllRecipes);
router.post("/suggest", recipeController.getSuggestedRecipes);
router.get("/:id", recipeController.getRecipeById);
router.post("/:recipeId/rate", authMiddleware, recipeController.rateRecipe);
router.post("/:id/adjust-servings", recipeController.adjustServings);
router.get("/dietary/:preference", recipeController.getRecipesByDietaryPreference);
router.get("/category/quick", recipeController.getQuickRecipes);
router.get("/search/ingredients", recipeController.searchRecipesByIngredients);

module.exports = router; 