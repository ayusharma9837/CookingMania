const db = require("../config/db");

exports.toggleFavorite = async (req, res, next) => {
  const user_id = req.user.id;
  const recipe_id = req.params.recipeId;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM UserFavorites WHERE user_id = ? AND recipe_id = ?",
      [user_id, recipe_id]
    );

    if (rows.length > 0) {
      await db.execute(
        "DELETE FROM UserFavorites WHERE user_id = ? AND recipe_id = ?",
        [user_id, recipe_id]
      );
      return res.json({ msg: "Recipe removed from favorites." });
    } else {
      await db.execute(
        "INSERT INTO UserFavorites (user_id, recipe_id) VALUES (?, ?)",
        [user_id, recipe_id]
      );
      return res.json({ msg: "Recipe added to favorites." });
    }
  } catch (err) {
    next(err);
  }
};

exports.getFavorites = async (req, res, next) => {
  const user_id = req.user.id;

  try {
    const sql = `
            SELECT r.recipe_id, r.title, r.cooking_time_min, r.difficulty
            FROM Recipes r
            JOIN UserFavorites uf ON r.recipe_id = uf.recipe_id
            WHERE uf.user_id = ?
        `;
    const [recipes] = await db.execute(sql, [user_id]);

    res.json(recipes);
  } catch (err) {
    next(err);
  }
};

exports.getPersonalizedSuggestions = async (req, res, next) => {
  const user_id = req.user.id;

  try {
    const sql = `
            SELECT r.recipe_id, r.title 
            FROM Recipes r
            LEFT JOIN Ratings rat ON r.recipe_id = rat.recipe_id AND rat.user_id = ?
            WHERE rat.user_id IS NULL -- Only recipes the user hasn't rated
            ORDER BY (SELECT AVG(rating) FROM Ratings WHERE recipe_id = r.recipe_id) DESC
            LIMIT 10
        `;
    const [recipes] = await db.execute(sql, [user_id]);

    res.json(recipes);
  } catch (err) {
    next(err);
  }
};

exports.updatePreferences = async (req, res, next) => {
  const user_id = req.user.id;

  const { dietaryTags, maxCookTime } = req.body;

  try {
    res.json({
      msg: "Preferences updated successfully.",
      newPreferences: { dietaryTags, maxCookTime },
    });
  } catch (err) {
    next(err);
  }
};
