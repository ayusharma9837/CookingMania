const db = require("../config/db");
const queryHelper = require("./utils/queryHelper");

exports.getAllRecipes = async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const page = parseInt(req.query.page, 10) || 1;
  const offset = (page - 1) * limit;

  if (isNaN(limit) || isNaN(offset)) {
    return res.status(400).json({ msg: "Invalid pagination values" });
  }

  try {
    const sql = `
            SELECT r.recipe_id, r.title, r.cooking_time_min, r.difficulty,
                   AVG(rat.rating) AS average_rating
            FROM Recipes r
            LEFT JOIN Ratings rat ON r.recipe_id = rat.recipe_id
            GROUP BY r.recipe_id
            ORDER BY r.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

    console.log(" SQL:", sql);
    console.log(" VALUES:", [limit, offset]);
    console.log("limit typeof:", typeof limit);
    console.log("offset typeof:", typeof offset);

    const [recipes] = await db.execute(sql);

    const [[{ total }]] = await db.execute(
      "SELECT COUNT(*) AS total FROM Recipes"
    );

    res.json({
      recipes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("Database Error in getAllRecipes:", err);
    next(err);
  }
};

exports.getRecipeById = async (req, res, next) => {
  const recipe_id = req.params.id;

  try {
    const recipeSql = `
            SELECT r.*, ni.calories, ni.protein_g, ni.fat_g, ni.carbs_g 
            FROM Recipes r
            LEFT JOIN NutritionalInfo ni ON r.recipe_id = ni.recipe_id
            WHERE r.recipe_id = ?
        `;
    const [recipes] = await db.execute(recipeSql, [recipe_id]);
    if (!recipes.length) {
      return res.status(404).json({ msg: "Recipe not found." });
    }
    const recipe = recipes[0];

    const ingredientsSql = `
            SELECT i.name, ri.quantity_unit 
            FROM RecipeIngredients ri
            JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id = ?
        `;
    const [ingredients] = await db.execute(ingredientsSql, [recipe_id]);
    recipe.ingredients = ingredients;

    const tagsSql = `
            SELECT dt.tag_name 
            FROM RecipeTags rt
            JOIN DietaryTags dt ON rt.tag_id = dt.tag_id
            WHERE rt.recipe_id = ?
        `;
    const [tags] = await db.execute(tagsSql, [recipe_id]);
    recipe.tags = tags.map((t) => t.tag_name);

    res.json(recipe);
  } catch (err) {
    next(err);
  }
};

exports.getSuggestedRecipes = async (req, res, next) => {
  const {
  ingredients,
  difficulty,
  time: maxTime,
  dietary: dietaryString,
} = req.body;

 if (!ingredients || !Array.isArray(ingredients)) {
  return res.status(400).json({ msg: "Ingredients list is required" });
}

  const userIngredients = ingredients.map(i => i.toLowerCase());

  const filters = { difficulty, maxTime, dietaryString };

  try {
    const scoredRecipes = await queryHelper.getScoredRecipeSuggestions(
      userIngredients,
      filters
    );

    res.json(scoredRecipes);
  } catch (err) {
    console.error("Error fetching suggested recipes:", err.message);
    next(err);
  }
};

exports.rateRecipe = async (req, res, next) => {
  const user_id = req.user.id;
  const recipe_id = req.params.recipeId;
  const { rating } = req.body;

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ msg: "Rating must be between 1 and 5." });
  }

  try {
    const sql = `
            INSERT INTO Ratings (recipe_id, user_id, rating) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE rating = VALUES(rating)
        `;
    await db.execute(sql, [recipe_id, user_id, rating]);

    const [[{ new_avg_rating }]] = await db.execute(
      "SELECT AVG(rating) AS new_avg_rating FROM Ratings WHERE recipe_id = ?",
      [recipe_id]
    );

    res.json({
      msg: "Rating saved successfully.",
      newAverageRating: parseFloat(new_avg_rating).toFixed(2),
    });
  } catch (err) {
    next(err);
  }
};

exports.adjustServings = async (req, res, next) => {
  const recipe_id = req.params.id;
  const { servings } = req.body;

  if (!servings || servings < 1 || servings > 20) {
    return res.status(400).json({
      msg: "Valid servings value between 1 and 20 is required.",
    });
  }

  try {
    const recipeSql = `
      SELECT r.recipe_id, r.title, r.servings as original_servings,
             ri.ingredient_id, ri.quantity_unit, i.name
      FROM Recipes r
      JOIN RecipeIngredients ri ON r.recipe_id = ri.recipe_id
      JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
      WHERE r.recipe_id = ?
    `;
    const [ingredients] = await db.execute(recipeSql, [recipe_id]);

    if (!ingredients.length) {
      return res.status(404).json({ msg: "Recipe not found." });
    }

    const originalServings = ingredients[0].original_servings;
    const scaleFactor = servings / originalServings;

    const scaleQuantity = (quantityUnit) => {
      const parts = quantityUnit.split(" ");
      if (parts.length >= 1 && !isNaN(parseFloat(parts[0]))) {
        const quantity = parseFloat(parts[0]);
        const unit = parts.slice(1).join(" ");
        const scaledQuantity = Math.round(quantity * scaleFactor * 100) / 100;

        const formattedQuantity =
          scaledQuantity % 1 === 0
            ? scaledQuantity.toString()
            : scaledQuantity.toFixed(2);

        return unit ? `${formattedQuantity} ${unit}` : formattedQuantity;
      }
      return quantityUnit;
    };

    const adjustedIngredients = ingredients.map((ing) => ({
      ingredient_id: ing.ingredient_id,
      name: ing.name,
      original_quantity: ing.quantity_unit,
      adjusted_quantity: scaleQuantity(ing.quantity_unit),
    }));

    const recipeDetailsSql = `
      SELECT r.title, r.cooking_time_min, r.difficulty, 
             ni.calories, ni.protein_g, ni.fat_g, ni.carbs_g
      FROM Recipes r
      LEFT JOIN NutritionalInfo ni ON r.recipe_id = ni.recipe_id
      WHERE r.recipe_id = ?
    `;
    const [recipeDetails] = await db.execute(recipeDetailsSql, [recipe_id]);
    const recipe = recipeDetails[0];

    let scaledNutrition = null;
    if (recipe.calories) {
      scaledNutrition = {
        calories: Math.round(recipe.calories * scaleFactor),
        protein_g: Math.round(recipe.protein_g * scaleFactor),
        fat_g: Math.round(recipe.fat_g * scaleFactor),
        carbs_g: Math.round(recipe.carbs_g * scaleFactor),
      };
    }

    res.json({
      msg: `Ingredients adjusted for ${servings} servings`,
      recipe: {
        recipe_id: parseInt(recipe_id),
        title: recipe.title,
        original_servings: originalServings,
        new_servings: servings,
        scale_factor: Math.round(scaleFactor * 100) / 100,
        cooking_time_min: recipe.cooking_time_min,
        difficulty: recipe.difficulty,
      },
      ingredients: adjustedIngredients,
      nutritional_info: scaledNutrition,
      notes: [
        "Cooking time may vary slightly with different quantities.",
        "Taste and adjust seasonings as needed.",
      ],
    });
  } catch (err) {
    console.error("Error in adjustServings:", err);
    next(err);
  }
};

exports.getRecipesByDietaryPreference = async (req, res, next) => {
  const { dietary } = req.query;

  if (!dietary) {
    return res.status(400).json({
      msg: "Dietary preference is required (e.g., vegetarian, gluten-free).",
    });
  }

  try {
    const sql = `
      SELECT DISTINCT r.recipe_id, r.title, r.cooking_time_min, r.difficulty,
             AVG(rat.rating) AS average_rating,
             ni.calories, ni.protein_g
      FROM Recipes r
      JOIN RecipeTags rt ON r.recipe_id = rt.recipe_id
      JOIN DietaryTags dt ON rt.tag_id = dt.tag_id
      LEFT JOIN Ratings rat ON r.recipe_id = rat.recipe_id
      LEFT JOIN NutritionalInfo ni ON r.recipe_id = ni.recipe_id
      WHERE dt.tag_name = ?
      GROUP BY r.recipe_id
      ORDER BY average_rating DESC, r.title ASC
    `;

    const [recipes] = await db.execute(sql, [dietary]);

    if (recipes.length === 0) {
      return res.status(404).json({
        msg: `No recipes found for dietary preference: ${dietary}`,
      });
    }

    res.json({
      dietary_preference: dietary,
      count: recipes.length,
      recipes,
    });
  } catch (err) {
    console.error("Error in getRecipesByDietaryPreference:", err);
    next(err);
  }
};

exports.getQuickRecipes = async (req, res, next) => {
  const maxTime = parseInt(req.query.maxTime) || 30;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const sql = `
      SELECT r.recipe_id, r.title, r.cooking_time_min, r.difficulty,
             AVG(rat.rating) AS average_rating,
             ni.calories
      FROM Recipes r
      LEFT JOIN Ratings rat ON r.recipe_id = rat.recipe_id
      LEFT JOIN NutritionalInfo ni ON r.recipe_id = ni.recipe_id
      WHERE r.cooking_time_min <= ?
      GROUP BY r.recipe_id
      ORDER BY r.cooking_time_min ASC, average_rating DESC
      LIMIT ?
    `;

    const [recipes] = await db.execute(sql, [maxTime, limit]);

    res.json({
      max_cooking_time: maxTime,
      count: recipes.length,
      recipes,
    });
  } catch (err) {
    console.error("Error in getQuickRecipes:", err);
    next(err);
  }
};

exports.searchRecipesByIngredients = async (req, res, next) => {
  const { ingredients } = req.query;

  if (!ingredients) {
    return res.status(400).json({
      msg: "Ingredients parameter is required for search.",
    });
  }

  const searchIngredients = ingredients
    .split(",")
    .map((ing) => ing.trim().toLowerCase());

  try {
    const sql = `
      SELECT r.recipe_id, r.title, r.cooking_time_min, r.difficulty,
             AVG(rat.rating) AS average_rating,
             COUNT(DISTINCT i.ingredient_id) AS matching_ingredients_count
      FROM Recipes r
      JOIN RecipeIngredients ri ON r.recipe_id = ri.recipe_id
      JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
      LEFT JOIN Ratings rat ON r.recipe_id = rat.recipe_id
      WHERE LOWER(i.name) IN (?)
      GROUP BY r.recipe_id
      HAVING matching_ingredients_count = ?
      ORDER BY average_rating DESC, r.title ASC
    `;

    const [recipes] = await db.execute(sql, [
      searchIngredients,
      searchIngredients.length,
    ]);

    res.json({
      search_ingredients: searchIngredients,
      exact_match_count: recipes.length,
      recipes,
    });
  } catch (err) {
    console.error("Error in searchRecipesByIngredients:", err);
    next(err);
  }
};
