const fs = require("fs/promises");
const path = require("path");
const db = require("../config/db");
const aiService = require("./utils/aiService");

const normalizeIngredients = (recognizedList) => {
  const stopWords = new Set([
    "ingredient", "powder", "food", "produce", "utensil", 
    "kitchenware", "spice", "seasoning", "dish", "meal",
    "cuisine", "breakfast", "lunch", "dinner", "snack",
    "beverage", "drink", "plate", "bowl", "cutlery"
  ]);

  const consolidationMap = {
    // Flours
    "whole-wheat flour": "flour",
    "rice flour": "flour",
    "all-purpose flour": "flour",
    "bread flour": "flour",
    "cake flour": "flour",
    "self-raising flour": "flour",
    "plain flour": "flour",
    
    // Starches
    "corn starch": "cornstarch",
    "potato starch": "starch",
    "arrowroot powder": "starch",
    
    // Proteins
    "chicken breast": "chicken",
    "chicken thigh": "chicken",
    "chicken wing": "chicken",
    "ground beef": "beef",
    "beef steak": "beef",
    "pork chop": "pork",
    "pork loin": "pork",
    "salmon fillet": "salmon",
    "tuna steak": "tuna",
    
    // Legumes
    "chickpeas": "chickpea",
    "black beans": "black bean",
    "kidney beans": "kidney bean",
    "lentils": "lentil",
    
    // Vegetables
    "garlic clove": "garlic",
    "garlic cloves": "garlic",
    "onion slice": "onion",
    "onion slices": "onion",
    "tomato slice": "tomato",
    "tomato slices": "tomato",
    "bell pepper": "pepper",
    "red pepper": "pepper",
    "green pepper": "pepper",
    "yellow pepper": "pepper",
    
    // Dairy
    "whole milk": "milk",
    "skim milk": "milk",
    "low-fat milk": "milk",
    "full-fat milk": "milk",
    "unsalted butter": "butter",
    "salted butter": "butter",
    
    // Herbs
    "fresh basil": "basil",
    "dried basil": "basil",
    "fresh parsley": "parsley",
    "dried parsley": "parsley",
    "fresh cilantro": "cilantro",
    "dried cilantro": "cilantro",
    
    // Oils
    "olive oil": "oil",
    "vegetable oil": "oil",
    "canola oil": "oil",
    "sunflower oil": "oil",
    
    // Sweeteners
    "white sugar": "sugar",
    "brown sugar": "sugar",
    "caster sugar": "sugar",
    "granulated sugar": "sugar"
  };

  const synonyms = {
    "eggplant": "aubergine",
    "zucchini": "courgette",
    "cilantro": "coriander",
    "bell pepper": "capsicum",
    "scallion": "spring onion",
    "arugula": "rocket"
  };

  const finalIngredients = new Set();

  recognizedList.forEach((item) => {
    let lowerItem = item.trim().toLowerCase();

    lowerItem = lowerItem
      .replace(/^\s*(fresh|dried|raw|cooked|boiled|fried|baked|grilled|roasted|chopped|sliced|diced|minced|grated)\s+/i, '')
      .replace(/\s+(fresh|dried|raw|cooked|boiled|fried|baked|grilled|roasted|chopped|sliced|diced|minced|grated)$/i, '');

    if (stopWords.has(lowerItem) || lowerItem.length < 3) {
      return;
    }

    
    let processedItem = lowerItem;
    if (lowerItem.endsWith("s") && !lowerItem.endsWith("ss")) {
      processedItem = lowerItem.slice(0, -1);
    }

    
    const genericName = consolidationMap[processedItem] || processedItem;
    
   
    const finalName = synonyms[genericName] || genericName;

    finalIngredients.add(finalName);
  });

  return Array.from(finalIngredients);
};

exports.recognizeIngredients = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ msg: "No image file uploaded." });
  }

  const imagePath = req.file.path;

  try {
    const rawRecognizedList = await aiService.analyzeImageForIngredients(
      imagePath
    );

    console.log("Raw AI recognition:", rawRecognizedList);
    
    const cleanRecognizedList = normalizeIngredients(rawRecognizedList);
    
    console.log("Cleaned ingredients:", cleanRecognizedList);

   
    let immediateSuggestions = [];
    if (cleanRecognizedList.length > 0) {
      try {
        const [suggestions] = await db.execute(
          `SELECT r.recipe_id, r.title, r.cooking_time_min, r.difficulty
           FROM Recipes r
           JOIN RecipeIngredients ri ON r.recipe_id = ri.recipe_id
           JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
           WHERE i.name IN (?)
           GROUP BY r.recipe_id
           ORDER BY COUNT(i.ingredient_id) DESC
           LIMIT 5`,
          [cleanRecognizedList]
        );
        immediateSuggestions = suggestions;
      } catch (suggestionErr) {
        console.error("Error fetching immediate suggestions:", suggestionErr.message);
        
      }
    }

    try {
      await fs.unlink(imagePath);
    } catch (cleanupErr) {
      console.error("Warning: Failed to delete temp file:", cleanupErr.message);
    }

    res.json({
      msg: "Ingredients classified successfully.",
      recognizedIngredients: cleanRecognizedList,
      immediateSuggestions: immediateSuggestions,
      confidence: cleanRecognizedList.length > 0 ? "high" : "low"
    });
  } catch (err) {
    try {
      await fs.unlink(imagePath);
    } catch (cleanupErr) {
      console.error("Cleanup failed on AI error:", cleanupErr.message);
    }

    console.error("AI Recognition failed:", err.message);
    next({
      statusCode: 503,
      message: err.message || "External AI service is unavailable.",
    });
  }
};

exports.getSubstitution = async (req, res, next) => {
  const missingIngredient = req.query.missingIngredient;

  if (!missingIngredient) {
    return res
      .status(400)
      .json({ msg: "Please provide a missing ingredient for substitution." });
  } 

 
  const substitutions = {
    
    'milk': [
      { name: 'Almond Milk', ratio: '1:1', notes: 'Unsweetened for savory dishes' },
      { name: 'Soy Milk', ratio: '1:1', notes: 'Good for baking and cooking' },
      { name: 'Oat Milk', ratio: '1:1', notes: 'Creamy, good for soups' },
      { name: 'Coconut Milk', ratio: '1:1', notes: 'Adds coconut flavor' },
      { name: 'Water', ratio: '1:1', notes: 'In baking or sauces in a pinch' }
    ],
    'butter': [
      { name: 'Vegetable Oil', ratio: '3/4:1', notes: '3/4 cup oil per 1 cup butter' },
      { name: 'Margarine', ratio: '1:1', notes: 'Direct substitute' },
      { name: 'Coconut Oil', ratio: '1:1', notes: 'Solid state works best' },
      { name: 'Olive Oil', ratio: '3/4:1', notes: 'For cooking, not baking' },
      { name: 'Applesauce', ratio: '1:1', notes: 'For baking, reduces fat' }
    ],
    'cheese': [
      { name: 'Nutritional Yeast', ratio: '1:4', notes: '1 tbsp yeast per 1/4 cup cheese' },
      { name: 'Tofu', ratio: '1:1', notes: 'Blended for creamy texture' },
      { name: 'Vegan Cheese', ratio: '1:1', notes: 'Commercial alternatives' },
      { name: 'Mashed Avocado', ratio: '1:1', notes: 'For creamy texture in dips' }
    ],
    'yogurt': [
      { name: 'Sour Cream', ratio: '1:1', notes: 'Similar tangy flavor' },
      { name: 'Buttermilk', ratio: '1:1', notes: 'In baking and dressings' },
      { name: 'Coconut Cream', ratio: '1:1', notes: 'Dairy-free alternative' }
    ],
    'cream': [
      { name: 'Coconut Cream', ratio: '1:1', notes: 'Rich and creamy' },
      { name: 'Evaporated Milk', ratio: '1:1', notes: 'Less fat but similar texture' },
      { name: 'Greek Yogurt', ratio: '1:1', notes: 'For sauces and soups' }
    ],

    
    'chicken': [
      { name: 'Tofu', ratio: '1:1', notes: 'Firm or extra firm, press well' },
      { name: 'Pork Tenderloin', ratio: '1:1', notes: 'Similar cooking time' },
      { name: 'Turkey Cutlets', ratio: '1:1', notes: 'Lean white meat' },
      { name: 'Chickpeas', ratio: '1:1', notes: 'For salads and stews' },
      { name: 'Tempeh', ratio: '1:1', notes: 'Nutty flavor, high protein' }
    ],
    'beef': [
      { name: 'Lentils', ratio: '1:1', notes: 'Cooked, for ground beef dishes' },
      { name: 'Mushrooms', ratio: '1:1', notes: 'Portobello for meaty texture' },
      { name: 'Ground Turkey', ratio: '1:1', notes: 'Leaner alternative' },
      { name: 'Tofu', ratio: '1:1', notes: 'Extra firm, pressed' },
      { name: 'Eggplant', ratio: '1:1', notes: 'For stews and casseroles' }
    ],
    'egg': [
      { name: 'Flax Egg', ratio: '1:1', notes: '1 tbsp ground flax + 3 tbsp water per egg' },
      { name: 'Applesauce', ratio: '1/4 cup:1', notes: '1/4 cup per egg in baking' },
      { name: 'Banana', ratio: '1/2:1', notes: '1/2 mashed banana per egg' },
      { name: 'Commercial Egg Replacer', ratio: 'As package', notes: 'Follow package instructions' },
      { name: 'Yogurt', ratio: '1/4 cup:1', notes: '1/4 cup per egg in baking' }
    ],
    'fish': [
      { name: 'Tofu', ratio: '1:1', notes: 'Firm, marinated for flavor' },
      { name: 'Chicken', ratio: '1:1', notes: 'In recipes where fish is protein' },
      { name: 'Mushrooms', ratio: '1:1', notes: 'For fish-like texture in stews' }
    ],

    
    'flour': [
      { name: 'Almond Flour', ratio: '1:1', notes: 'Add binding agent like eggs' },
      { name: 'Oat Flour', ratio: '1:1', notes: 'Grind oats in blender' },
      { name: 'Rice Flour', ratio: '1:1', notes: 'Good for gluten-free baking' },
      { name: 'Coconut Flour', ratio: '1:4', notes: '1/4 cup coconut flour per 1 cup regular' },
      { name: 'Gluten-Free Flour Blend', ratio: '1:1', notes: 'Commercial blends work best' }
    ],
    'pasta': [
      { name: 'Zucchini Noodles', ratio: '1:1', notes: 'Low carb, fresh' },
      { name: 'Spaghetti Squash', ratio: '1:1', notes: 'Bake and shred' },
      { name: 'Rice Noodles', ratio: '1:1', notes: 'Gluten-free alternative' },
      { name: 'Gluten-Free Pasta', ratio: '1:1', notes: 'Various types available' },
      { name: 'Shirataki Noodles', ratio: '1:1', notes: 'Very low calorie' }
    ],
    'rice': [
      { name: 'Quinoa', ratio: '1:1', notes: 'Higher protein, similar cooking' },
      { name: 'Cauliflower Rice', ratio: '1:1', notes: 'Low carb, quick cooking' },
      { name: 'Couscous', ratio: '1:1', notes: 'Quick cooking, small grain' },
      { name: 'Barley', ratio: '1:1', notes: 'Chewy texture, nutty flavor' },
      { name: 'Bulgur', ratio: '1:1', notes: 'Quick cooking, light texture' }
    ],
    'bread': [
      { name: 'Lettuce Wraps', ratio: '1:1', notes: 'For sandwiches and burgers' },
      { name: 'Tortillas', ratio: '1:1', notes: 'Corn or flour alternatives' },
      { name: 'Rice Cakes', ratio: '1:1', notes: 'For open-faced sandwiches' },
      { name: 'Gluten-Free Bread', ratio: '1:1', notes: 'Commercial alternatives' }
    ],

    
    'onion': [
      { name: 'Shallots', ratio: '1:1', notes: 'Milder flavor' },
      { name: 'Leeks', ratio: '1:1', notes: 'Milder, use white parts only' },
      { name: 'Onion Powder', ratio: '1 tbsp:1 medium', notes: '1 tbsp powder per medium onion' },
      { name: 'Celery', ratio: '1:1', notes: 'Adds crunch, different flavor' },
      { name: 'Fennel', ratio: '1:1', notes: 'Anise flavor, cooks similarly' }
    ],
    'garlic': [
      { name: 'Garlic Powder', ratio: '1/8 tsp:1 clove', notes: '1/8 tsp powder per fresh clove' },
      { name: 'Shallots', ratio: '1:2', notes: '1 shallot per 2 garlic cloves' },
      { name: 'Chives', ratio: '1 tbsp:1 clove', notes: '1 tbsp fresh chives per clove' },
      { name: 'Asafoetida Powder', ratio: 'Pinch:2-3 cloves', notes: 'Pinch for 2-3 cloves, use sparingly' }
    ],
    'tomato': [
      { name: 'Tomato Paste + Water', ratio: '1:3', notes: '1 tbsp paste + 2 tbsp water per tomato' },
      { name: 'Canned Tomatoes', ratio: '1:1', notes: 'Diced or crushed' },
      { name: 'Red Bell Pepper', ratio: '1:1', notes: 'Different flavor, similar texture' },
      { name: 'Tamarind Paste', ratio: '1:2', notes: 'For acidity in sauces' }
    ],
    'potato': [
      { name: 'Sweet Potato', ratio: '1:1', notes: 'Different flavor, similar texture' },
      { name: 'Cauliflower', ratio: '1:1', notes: 'For mashed alternatives' },
      { name: 'Turnip', ratio: '1:1', notes: 'Lower carb, similar when cooked' },
      { name: 'Parsnip', ratio: '1:1', notes: 'Sweet flavor, good roasted' }
    ],

    
    'sugar': [
      { name: 'Honey', ratio: '3/4:1', notes: '3/4 cup honey per 1 cup sugar, reduce liquid' },
      { name: 'Maple Syrup', ratio: '3/4:1', notes: '3/4 cup syrup per 1 cup sugar' },
      { name: 'Agave Nectar', ratio: '2/3:1', notes: '2/3 cup agave per 1 cup sugar' },
      { name: 'Stevia', ratio: 'As package', notes: 'Follow package conversion' },
      { name: 'Coconut Sugar', ratio: '1:1', notes: 'Direct substitute, caramel flavor' }
    ],
    'salt': [
      { name: 'Soy Sauce', ratio: '2:1', notes: '2 tbsp soy sauce per 1 tsp salt, reduce liquid' },
      { name: 'Tamari', ratio: '2:1', notes: 'Gluten-free soy sauce alternative' },
      { name: 'Miso Paste', ratio: '1:1', notes: 'Adds umami flavor' },
      { name: 'Sea Salt', ratio: '1:1', notes: 'Direct substitute' },
      { name: 'Herb Blends', ratio: '1:1', notes: 'Salt-free seasoning mixes' }
    ],
    'oil': [
      { name: 'Butter', ratio: '1:1', notes: 'For cooking, not high-heat' },
      { name: 'Ghee', ratio: '1:1', notes: 'Clarified butter, high smoke point' },
      { name: 'Applesauce', ratio: '1:1', notes: 'For baking only' },
      { name: 'Mashed Banana', ratio: '1:1', notes: 'For baking, adds sweetness' },
      { name: 'Avocado Oil', ratio: '1:1', notes: 'High smoke point, neutral flavor' }
    ],
    'vinegar': [
      { name: 'Lemon Juice', ratio: '1:1', notes: 'For acidity in dressings' },
      { name: 'Lime Juice', ratio: '1:1', notes: 'Similar acidity, different flavor' },
      { name: 'White Wine', ratio: '1:1', notes: 'For cooking, alcohol cooks off' }
    ],

    
    'basil': [
      { name: 'Oregano', ratio: '1:1', notes: 'Different flavor profile' },
      { name: 'Thyme', ratio: '1:1', notes: 'Woody, earthy flavor' },
      { name: 'Italian Seasoning', ratio: '1:1', notes: 'Blend of Mediterranean herbs' }
    ],
    'parsley': [
      { name: 'Cilantro', ratio: '1:1', notes: 'Different flavor, similar appearance' },
      { name: 'Celery Leaves', ratio: '1:1', notes: 'Mild, fresh flavor' },
      { name: 'Chervil', ratio: '1:1', notes: 'Delicate anise flavor' }
    ]
  };

  const lowerIngredient = missingIngredient.toLowerCase().trim();
  const suggested = substitutions[lowerIngredient] || [
    { 
      name: `No common substitution found for ${missingIngredient}`, 
      ratio: 'N/A', 
      notes: 'Consider searching online for specific alternatives or omitting if possible.' 
    }
  ];

  res.json({
    missing: missingIngredient,
    substitutions: suggested,
    search_tips: [
      "Always taste and adjust when using substitutions",
      "Consider texture differences in your final dish",
      "Some substitutions may alter cooking times",
      "For baking, substitutions can significantly affect results"
    ]
  });
};


exports.getBulkSubstitutions = async (req, res, next) => {
  const { ingredients } = req.query;

  if (!ingredients) {
    return res.status(400).json({ 
      msg: "Please provide ingredients as comma-separated list for bulk substitution." 
    });
  }

  const ingredientList = ingredients.split(',').map(ing => ing.trim());
  const substitutionResults = {};

 
  const substitutions = {
    'milk': [{ name: 'Almond Milk', ratio: '1:1', notes: 'Unsweetened for savory dishes' }],
    'butter': [{ name: 'Vegetable Oil', ratio: '3/4:1', notes: '3/4 cup oil per 1 cup butter' }],
    'egg': [{ name: 'Flax Egg', ratio: '1:1', notes: '1 tbsp ground flax + 3 tbsp water per egg' }],
    'flour': [{ name: 'Almond Flour', ratio: '1:1', notes: 'Add binding agent like eggs' }],
   
  };

  ingredientList.forEach(ingredient => {
    const lowerIngredient = ingredient.toLowerCase();
    substitutionResults[ingredient] = substitutions[lowerIngredient] || [
      { 
        name: `No common substitution found`, 
        ratio: 'N/A', 
        notes: 'Search online for alternatives' 
      }
    ];
  });

  res.json({
    original_ingredients: ingredientList,
    substitutions: substitutionResults,
    note: "Some substitutions may work better than others depending on the recipe."
  });
};


exports.validateIngredients = async (req, res, next) => {
  const { ingredients } = req.query;

  if (!ingredients) {
    return res.status(400).json({ 
      msg: "Please provide ingredients to validate." 
    });
  }

  const ingredientList = ingredients.split(',').map(ing => ing.trim().toLowerCase());

  try {
    const placeholders = ingredientList.map(() => '?').join(',');
    const sql = `
      SELECT name, ingredient_id 
      FROM Ingredients 
      WHERE LOWER(name) IN (${placeholders})
    `;

    const [foundIngredients] = await db.execute(sql, ingredientList);
    
    const foundNames = new Set(foundIngredients.map(ing => ing.name.toLowerCase()));
    const missingIngredients = ingredientList.filter(ing => !foundNames.has(ing));

    res.json({
      validated_ingredients: ingredientList,
      found_in_database: foundIngredients,
      missing_from_database: missingIngredients,
      coverage_percentage: Math.round((foundIngredients.length / ingredientList.length) * 100)
    });
  } catch (err) {
    console.error("Error in validateIngredients:", err);
    next(err);
  }

};
