const db = require("../../config/db");

function getSimilarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  if (longer.includes(shorter) || shorter.includes(longer)) {
    return 0.8;
  }

  const intersection = [...shorter].filter((char) =>
    longer.includes(char)
  ).length;
  return intersection / longer.length;
}

function getConfidenceLevel(score, matchedCount, totalRequired) {
  if (score >= 0.8 && matchedCount >= 3) return "high";
  if (score >= 0.6 && matchedCount >= 2) return "medium";
  if (score >= 0.3 && matchedCount >= 1) return "low";
  return "very_low";
}

exports.getScoredRecipeSuggestions = async (userIngredients, filters) => {
  const normalizedUserIngredients = userIngredients.map((i) =>
    i.trim().toLowerCase()
  );

  if (normalizedUserIngredients.length === 0) {
    return [];
  }

  try {
    let filterSql = `
            SELECT DISTINCT r.recipe_id, r.title, r.cooking_time_min, r.difficulty, r.servings,
                    r.steps, ni.calories, ni.protein_g, ni.fat_g, ni.carbs_g
            FROM Recipes r
            LEFT JOIN NutritionalInfo ni ON r.recipe_id = ni.recipe_id
            WHERE 1=1 
        `;
    const filterParams = [];

    if (filters.maxTime) {
      filterSql += " AND r.cooking_time_min <= ?";
      filterParams.push(parseInt(filters.maxTime));
    }

    if (filters.difficulty) {
      filterSql += " AND r.difficulty = ?";
      filterParams.push(filters.difficulty);
    }

    if (filters.dietaryString && filters.dietaryString.trim() !== "") {
      const dietaryTags = filters.dietaryString
        .split(",")
        .map((tag) => tag.trim());
      if (dietaryTags.length > 0) {
        const placeholders = dietaryTags.map(() => "?").join(",");
        filterSql += `
                    AND r.recipe_id IN (
                        SELECT rt.recipe_id 
                        FROM RecipeTags rt 
                        JOIN DietaryTags dt ON rt.tag_id = dt.tag_id 
                        WHERE dt.tag_name IN (${placeholders})
                    )
                `;
        filterParams.push(...dietaryTags);
      }
    }

    const [filteredRecipes] = await db.execute(filterSql, filterParams);

    if (filteredRecipes.length === 0) {
      return [];
    }

    const recipeIds = filteredRecipes.map((r) => r.recipe_id);
    const recipeIdPlaceholders = recipeIds.map(() => "?").join(",");

    const ingredientsSql = `
            SELECT ri.recipe_id, i.name, ri.quantity_unit
            FROM RecipeIngredients ri
            JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id IN (${recipeIdPlaceholders})
            ORDER BY ri.recipe_id
        `;

    const ratingsSql = `
            SELECT recipe_id, AVG(rating) as avg_rating, COUNT(rating) as rating_count
            FROM Ratings
            WHERE recipe_id IN (${recipeIdPlaceholders})
            GROUP BY recipe_id
        `;

    const tagsSql = `
            SELECT rt.recipe_id, dt.tag_name
            FROM RecipeTags rt
            JOIN DietaryTags dt ON rt.tag_id = dt.tag_id
            WHERE rt.recipe_id IN (${recipeIdPlaceholders})
        `;

    const [allRequiredIngredients] = await db.execute(
      ingredientsSql,
      recipeIds
    );
    const [recipeRatings] = await db.execute(ratingsSql, recipeIds);
    const [recipeTags] = await db.execute(tagsSql, recipeIds);

    const ratingMap = new Map();
    recipeRatings.forEach((rating) => {
      ratingMap.set(rating.recipe_id, {
        average_rating: parseFloat(rating.avg_rating).toFixed(1),
        rating_count: rating.rating_count,
      });
    });

    const tagMap = new Map();
    recipeTags.forEach((tag) => {
      if (!tagMap.has(tag.recipe_id)) {
        tagMap.set(tag.recipe_id, []);
      }
      tagMap.get(tag.recipe_id).push(tag.tag_name);
    });

    const recipeIngredientMap = new Map();
    allRequiredIngredients.forEach((row) => {
      const id = row.recipe_id;
      const name = row.name.toLowerCase();
      const quantity = row.quantity_unit;

      if (!recipeIngredientMap.has(id)) {
        recipeIngredientMap.set(id, {
          requiredNames: [],
          quantities: [],
          totalRequired: 0,
        });
      }
      recipeIngredientMap.get(id).requiredNames.push(name);
      recipeIngredientMap.get(id).quantities.push({ name, quantity });
      recipeIngredientMap.get(id).totalRequired++;
    });

    const scoredRecipes = [];

    for (const recipe of filteredRecipes) {
      const recipeData = recipeIngredientMap.get(recipe.recipe_id);

      if (!recipeData) continue;

      const requiredNames = recipeData.requiredNames;
      const quantities = recipeData.quantities;
      const totalRequired = recipeData.totalRequired;

      let matchedCount = 0;
      const matchedIngredients = [];
      const missingIngredients = [];

      requiredNames.forEach((reqIng, index) => {
        let isMatched = false;

        if (normalizedUserIngredients.includes(reqIng)) {
          isMatched = true;
        }

        if (!isMatched) {
          const fuzzyMatch = normalizedUserIngredients.find((userIng) => {
            return (
              userIng.includes(reqIng) ||
              reqIng.includes(userIng) ||
              getSimilarity(userIng, reqIng) > 0.7
            );
          });

          if (fuzzyMatch) {
            isMatched = true;
          }
        }

        if (isMatched) {
          matchedCount++;
          matchedIngredients.push({
            name: reqIng,
            quantity: quantities[index].quantity,
            match_type: normalizedUserIngredients.includes(reqIng)
              ? "exact"
              : "fuzzy",
          });
        } else {
          missingIngredients.push({
            name: reqIng,
            quantity: quantities[index].quantity,
          });
        }
      });

      const baseScore = totalRequired > 0 ? matchedCount / totalRequired : 0;

      const completenessBonus =
        (matchedCount / Math.max(totalRequired, 1)) * 0.2;
      const ratingInfo = ratingMap.get(recipe.recipe_id);
      const ratingBonus =
        ratingInfo && parseFloat(ratingInfo.average_rating) > 3.5 ? 0.1 : 0;
      const missingPenalty = missingIngredients.length > 5 ? 0.1 : 0;

      const finalScore = Math.min(
        1,
        baseScore + completenessBonus + ratingBonus - missingPenalty
      );

      if (matchedCount > 0) {
        const recipeWithScore = {
          ...recipe,
          match_score: parseFloat(finalScore.toFixed(2)),
          match_percentage: Math.round(finalScore * 100),
          matched_ingredients: matchedCount,
          total_required: totalRequired,
          missing_ingredients: totalRequired - matchedCount,

          missing_ingredients_detail: missingIngredients,
          dietary_tags: tagMap.get(recipe.recipe_id) || [],
          user_rating: ratingMap.get(recipe.recipe_id) || {
            average_rating: "No ratings",
            rating_count: 0,
          },
          confidence: getConfidenceLevel(
            finalScore,
            matchedCount,
            totalRequired
          ),
        };

        scoredRecipes.push(recipeWithScore);
      }
    }

    scoredRecipes.sort((a, b) => {
      if (b.match_score !== a.match_score) {
        return b.match_score - a.match_score;
      }

      if (b.matched_ingredients !== a.matched_ingredients) {
        return b.matched_ingredients - a.matched_ingredients;
      }

      const aRating = parseFloat(a.user_rating.average_rating) || 0;
      const bRating = parseFloat(b.user_rating.average_rating) || 0;
      if (bRating !== aRating) {
        return bRating - aRating;
      }

      return a.cooking_time_min - b.cooking_time_min;
    });

    return scoredRecipes.slice(0, 15);
  } catch (err) {
    console.error("Error in getScoredRecipeSuggestions:", err);
    throw err;
  }
};

exports.advancedRecipeSearch = async (searchCriteria) => {
  const {
    ingredients = [],
    maxTime,
    difficulty,
    dietaryTags = [],
    maxCalories,
    minProtein,
    excludeIngredients = [],
    sortBy = "relevance",
  } = searchCriteria;

  try {
    let searchSql = `
            SELECT DISTINCT r.recipe_id, r.title, r.cooking_time_min, r.difficulty, r.servings,
                    r.steps, ni.calories, ni.protein_g, ni.fat_g, ni.carbs_g,
                    (SELECT AVG(rating) FROM Ratings WHERE recipe_id = r.recipe_id) as avg_rating,
                    (SELECT COUNT(rating) FROM Ratings WHERE recipe_id = r.recipe_id) as rating_count
            FROM Recipes r
            LEFT JOIN NutritionalInfo ni ON r.recipe_id = ni.recipe_id
            WHERE 1=1
        `;
    const searchParams = [];

    if (maxTime) {
      searchSql += " AND r.cooking_time_min <= ?";
      searchParams.push(parseInt(maxTime));
    }

    if (difficulty) {
      searchSql += " AND r.difficulty = ?";
      searchParams.push(difficulty);
    }

    if (dietaryTags.length > 0) {
      const placeholders = dietaryTags.map(() => "?").join(",");
      searchSql += `
                AND r.recipe_id IN (
                    SELECT rt.recipe_id 
                    FROM RecipeTags rt 
                    JOIN DietaryTags dt ON rt.tag_id = dt.tag_id 
                    WHERE dt.tag_name IN (${placeholders})
                )
            `;
      searchParams.push(...dietaryTags);
    }

    if (maxCalories) {
      searchSql += " AND ni.calories <= ?";
      searchParams.push(parseInt(maxCalories));
    }

    if (minProtein) {
      searchSql += " AND ni.protein_g >= ?";
      searchParams.push(parseInt(minProtein));
    }

    if (excludeIngredients.length > 0) {
      const placeholders = excludeIngredients.map(() => "?").join(",");
      searchSql += `
                AND r.recipe_id NOT IN (
                    SELECT DISTINCT ri.recipe_id
                    FROM RecipeIngredients ri
                    JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
                    WHERE i.name IN (${placeholders})
                )
            `;
      searchParams.push(...excludeIngredients);
    }

    switch (sortBy) {
      case "time":
        searchSql += " ORDER BY r.cooking_time_min ASC";
        break;
      case "rating":
        searchSql += " ORDER BY avg_rating DESC";
        break;
      case "calories":
        searchSql += " ORDER BY ni.calories ASC";
        break;
      case "protein":
        searchSql += " ORDER BY ni.protein_g DESC";
        break;
      default:
        searchSql += " ORDER BY avg_rating DESC, r.cooking_time_min ASC";
    }

    const [recipes] = await db.execute(searchSql, searchParams);

    if (ingredients.length > 0) {
      const normalizedIngredients = ingredients.map((ing) =>
        ing.trim().toLowerCase()
      );
      const recipeIds = recipes.map((r) => r.recipe_id);

      const ingredientsSql = `
                SELECT ri.recipe_id, i.name
                FROM RecipeIngredients ri
                JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
                WHERE ri.recipe_id IN (${recipeIds.map(() => "?").join(",")})
            `;
      const [recipeIngredients] = await db.execute(ingredientsSql, recipeIds);

      const scoredRecipes = recipes.map((recipe) => {
        const recipeIngs = recipeIngredients
          .filter((ri) => ri.recipe_id === recipe.recipe_id)
          .map((ri) => ri.name.toLowerCase());

        const matchedCount = recipeIngs.filter((ri) =>
          normalizedIngredients.some((ui) => ui.includes(ri) || ri.includes(ui))
        ).length;

        const score =
          recipeIngs.length > 0 ? matchedCount / recipeIngs.length : 0;

        return {
          ...recipe,
          match_score: parseFloat(score.toFixed(2)),
          matched_ingredients: matchedCount,
          total_ingredients: recipeIngs.length,
        };
      });

      if (sortBy === "relevance") {
        scoredRecipes.sort((a, b) => b.match_score - a.match_score);
      }

      return scoredRecipes;
    }

    return recipes;
  } catch (err) {
    console.error("Error in advancedRecipeSearch:", err);
    throw err;
  }
};

exports.getPersonalizedSuggestions = async (userId, limit = 10) => {
  try {
    const sql = `
            WITH UserFavorites AS (
                SELECT recipe_id FROM UserFavorites WHERE user_id = ?
            ),
            UserRatings AS (
                SELECT recipe_id, rating FROM Ratings WHERE user_id = ?
            ),
            FavoriteTags AS (
                SELECT DISTINCT dt.tag_id, dt.tag_name
                FROM UserFavorites uf
                JOIN RecipeTags rt ON uf.recipe_id = rt.recipe_id
                JOIN DietaryTags dt ON rt.tag_id = dt.tag_id
            ),
            FavoriteIngredients AS (
                SELECT DISTINCT i.ingredient_id, i.name
                FROM UserFavorites uf
                JOIN RecipeIngredients ri ON uf.recipe_id = ri.recipe_id
                JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
            )
            
            SELECT DISTINCT r.recipe_id, r.title, r.cooking_time_min, r.difficulty,
                    (SELECT AVG(rating) FROM Ratings WHERE recipe_id = r.recipe_id) as avg_rating,
                    (
                        -- Score based on shared tags with favorites
                        (SELECT COUNT(*) FROM RecipeTags rt 
                         JOIN FavoriteTags ft ON rt.tag_id = ft.tag_id 
                         WHERE rt.recipe_id = r.recipe_id) * 0.4 +
                        -- Score based on shared ingredients with favorites
                        (SELECT COUNT(*) FROM RecipeIngredients ri 
                         JOIN FavoriteIngredients fi ON ri.ingredient_id = fi.ingredient_id 
                         WHERE ri.recipe_id = r.recipe_id) * 0.6
                    ) as similarity_score
            FROM Recipes r
            -- Exclude recipes already favorited or rated poorly
            WHERE r.recipe_id NOT IN (SELECT recipe_id FROM UserFavorites)
              AND r.recipe_id NOT IN (SELECT recipe_id FROM UserRatings WHERE rating < 3)
            HAVING similarity_score > 0
            ORDER BY similarity_score DESC, avg_rating DESC
            LIMIT ?
        `;

    const [suggestions] = await db.execute(sql, [userId, userId, limit]);
    return suggestions;
  } catch (err) {
    console.error("Error in getPersonalizedSuggestions:", err);
    throw err;
  }
};

exports.findRecipesByIngredientCombinations = async (
  ingredientGroups,
  maxResults = 10
) => {
  try {
    let combinationSql = `
            SELECT r.recipe_id, r.title, r.cooking_time_min, r.difficulty
            FROM Recipes r
            WHERE 1=1
        `;
    const combinationParams = [];

    ingredientGroups.forEach((group, index) => {
      if (group.length > 0) {
        const placeholders = group.map(() => "?").join(",");
        combinationSql += `
                    AND r.recipe_id IN (
                        SELECT ri.recipe_id
                        FROM RecipeIngredients ri
                        JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
                        WHERE LOWER(i.name) IN (${placeholders})
                        GROUP BY ri.recipe_id
                        HAVING COUNT(DISTINCT i.name) = ?
                    )
                `;
        combinationParams.push(...group.map((ing) => ing.toLowerCase()));
        combinationParams.push(group.length);
      }
    });

    combinationSql += `
            ORDER BY (
                SELECT AVG(rating) FROM Ratings WHERE recipe_id = r.recipe_id
            ) DESC
            LIMIT ?
        `;
    combinationParams.push(maxResults);

    const [recipes] = await db.execute(combinationSql, combinationParams);
    return recipes;
  } catch (err) {
    console.error("Error in findRecipesByIngredientCombinations:", err);
    throw err;
  }
};
