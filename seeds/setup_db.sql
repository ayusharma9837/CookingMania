CREATE DATABASE IF NOT EXISTS smart_recipe_db;
USE smart_recipe_db;

CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE DietaryTags (
    tag_id INT AUTO_INCREMENT PRIMARY KEY,
    tag_name VARCHAR(50) UNIQUE NOT NULL 
);


CREATE TABLE Recipes (
    recipe_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    steps TEXT NOT NULL, 
    cooking_time_min INT NOT NULL, 
    difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL, 
    servings INT DEFAULT 4, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE Ingredients (
    ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE RecipeIngredients (
    recipe_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity_unit VARCHAR(100) NOT NULL, 
    PRIMARY KEY (recipe_id, ingredient_id),
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES Ingredients(ingredient_id) ON DELETE RESTRICT
);

CREATE TABLE RecipeTags (
    recipe_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (recipe_id, tag_id),
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES DietaryTags(tag_id) ON DELETE CASCADE
);

CREATE TABLE NutritionalInfo (
    recipe_id INT PRIMARY KEY,
    calories INT,
    protein_g INT,
    fat_g INT,
    carbs_g INT,
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE 
);


CREATE TABLE Ratings (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT CHECK (rating >= 1 AND rating <= 5),
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rating (recipe_id, user_id),
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE UserFavorites (
    user_id INT NOT NULL,
    recipe_id INT NOT NULL,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE, 
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE
);

INSERT INTO DietaryTags (tag_name) VALUES
('Vegetarian'), ('Gluten-Free'), ('Vegan'), ('Low-Carb'),
('Easy'), ('Medium'), ('Hard'), ('30-Minutes-Quick'),
('Lunch'), ('Dinner'), ('Breakfast');

SET @veg_tag = (SELECT tag_id FROM DietaryTags WHERE tag_name = 'Vegetarian');
SET @gf_tag = (SELECT tag_id FROM DietaryTags WHERE tag_name = 'Gluten-Free');
SET @easy_tag = (SELECT tag_id FROM DietaryTags WHERE tag_name = 'Easy');
SET @medium_tag = (SELECT tag_id FROM DietaryTags WHERE tag_name = 'Medium');

INSERT INTO Ingredients (name) VALUES
('Egg'), ('Flour'), ('Milk'), ('Butter'), ('Sugar'), 
('Tomato'), ('Onion'), ('Garlic'), ('Chicken Breast'), ('Tofu'),
('Rice'), ('Salt'), ('Pepper'), ('Broccoli'), ('Pasta');

INSERT INTO Recipes (title, steps, cooking_time_min, difficulty) VALUES
('Classic Omelette', 'Beat eggs. Pour into pan. Cook until set. Fold and serve.', 10, 'Easy');
SET @recipe_id_1 = LAST_INSERT_ID();
INSERT INTO RecipeTags (recipe_id, tag_id) VALUES (@recipe_id_1, @veg_tag), (@recipe_id_1, @gf_tag), (@recipe_id_1, @easy_tag);
INSERT INTO NutritionalInfo (recipe_id, calories, protein_g) VALUES (@recipe_id_1, 200, 14);
INSERT INTO RecipeIngredients (recipe_id, ingredient_id, quantity_unit) VALUES 
(@recipe_id_1, (SELECT ingredient_id FROM Ingredients WHERE name = 'Egg'), '3 large'),
(@recipe_id_1, (SELECT ingredient_id FROM Ingredients WHERE name = 'Butter'), '1 tbsp'),
(@recipe_id_1, (SELECT ingredient_id FROM Ingredients WHERE name = 'Salt'), '1 pinch');

-- Recipe 2: Chicken Stir-Fry
INSERT INTO Recipes (title, steps, cooking_time_min, difficulty) VALUES
('Chicken Stir-Fry', 'Slice chicken and vegetables. Cook chicken. Add vegetables and sauce. Serve with rice.', 25, 'Medium');
SET @recipe_id_2 = LAST_INSERT_ID();
INSERT INTO RecipeTags (recipe_id, tag_id) VALUES (@recipe_id_2, @medium_tag);
INSERT INTO NutritionalInfo (recipe_id, calories, protein_g) VALUES (@recipe_id_2, 450, 40);
INSERT INTO RecipeIngredients (recipe_id, ingredient_id, quantity_unit) VALUES 
(@recipe_id_2, (SELECT ingredient_id FROM Ingredients WHERE name = 'Chicken Breast'), '1.5 lbs'),
(@recipe_id_2, (SELECT ingredient_id FROM Ingredients WHERE name = 'Broccoli'), '1 head'),
(@recipe_id_2, (SELECT ingredient_id FROM Ingredients WHERE name = 'Rice'), '1 cup');

-- Recipe 3: Simple Tomato Pasta
INSERT INTO Recipes (title, steps, cooking_time_min, difficulty) VALUES
('Simple Tomato Pasta', 'Boil pasta. Sauté garlic and onion. Add crushed tomatoes. Combine with pasta.', 20, 'Easy');
SET @recipe_id_3 = LAST_INSERT_ID();
INSERT INTO RecipeTags (recipe_id, tag_id) VALUES (@recipe_id_3, @veg_tag), (@recipe_id_3, @easy_tag);
INSERT INTO NutritionalInfo (recipe_id, calories, protein_g) VALUES (@recipe_id_3, 350, 12);
INSERT INTO RecipeIngredients (recipe_id, ingredient_id, quantity_unit) VALUES 
(@recipe_id_3, (SELECT ingredient_id FROM Ingredients WHERE name = 'Pasta'), '8 oz'),
(@recipe_id_3, (SELECT ingredient_id FROM Ingredients WHERE name = 'Tomato'), '1 can'),
(@recipe_id_3, (SELECT ingredient_id FROM Ingredients WHERE name = 'Garlic'), '2 cloves');


-- Placeholder for Recipe 4: Tofu Scramble (Vegetarian, Easy
INSERT INTO Recipes (title, steps, cooking_time_min, difficulty) VALUES ('Tofu Scramble', 'Scramble tofu with spices and vegetables.', 15, 'Easy');
SET @recipe_id_4 = LAST_INSERT_ID();
INSERT INTO RecipeTags (recipe_id, tag_id) VALUES (@recipe_id_4, @veg_tag), (@recipe_id_4, @easy_tag);
INSERT INTO NutritionalInfo (recipe_id, calories, protein_g) VALUES (@recipe_id_4, 280, 20);
INSERT INTO RecipeIngredients (recipe_id, ingredient_id, quantity_unit) VALUES 
(@recipe_id_4, (SELECT ingredient_id FROM Ingredients WHERE name = 'Tofu'), '1 block'),
(@recipe_id_4, (SELECT ingredient_id FROM Ingredients WHERE name = 'Onion'), '0.5');

-- Recipe 5: Garlic Butter Rice (Vegetarian, Easy)
INSERT INTO Recipes (title, steps, cooking_time_min, difficulty) VALUES
('Garlic Butter Rice', 'Cook rice. Melt butter in pan, add garlic. Mix with cooked rice.', 15, 'Easy');
SET @recipe_id_5 = LAST_INSERT_ID();
INSERT INTO RecipeTags (recipe_id, tag_id) VALUES (@recipe_id_5, @veg_tag), (@recipe_id_5, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_5, 300, 6, 5, 55);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_5, (SELECT ingredient_id FROM Ingredients WHERE name='Rice'), '1 cup'),
(@recipe_id_5, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '3 cloves'),
(@recipe_id_5, (SELECT ingredient_id FROM Ingredients WHERE name='Butter'), '1 tbsp'),
(@recipe_id_5, (SELECT ingredient_id FROM Ingredients WHERE name='Salt'), '1 tsp');

-- Recipe 6: Grilled Chicken (Medium)
INSERT INTO Recipes VALUES (NULL, 'Grilled Chicken', 'Marinate chicken. Grill 10–12 minutes per side.', 30, 'Medium', 4, NOW(), NOW());
SET @recipe_id_6 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_6, @medium_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_6, 500, 48, 10, 8);
INSERT INTO RecipeIngredients VALUES 
(@recipe_id_6, (SELECT ingredient_id FROM Ingredients WHERE name='Chicken Breast'), '2 pieces'),
(@recipe_id_6, (SELECT ingredient_id FROM Ingredients WHERE name='Salt'), '1 tsp'),
(@recipe_id_6, (SELECT ingredient_id FROM Ingredients WHERE name='Pepper'), '1 tsp');

-- Recipe 7: Veg Fried Rice (Vegetarian, Easy)
INSERT INTO Recipes VALUES (NULL, 'Vegetable Fried Rice', 'Cook rice. Stir-fry vegetables. Mix and serve.', 20, 'Easy', 4, NOW(), NOW());
SET @recipe_id_7 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_7, @veg_tag), (@recipe_id_7, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_7, 380, 8, 7, 60);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_7, (SELECT ingredient_id FROM Ingredients WHERE name='Rice'), '2 cups'),
(@recipe_id_7, (SELECT ingredient_id FROM Ingredients WHERE name='Onion'), '1 diced'),
(@recipe_id_7, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '2 cloves'),
(@recipe_id_7, (SELECT ingredient_id FROM Ingredients WHERE name='Salt'), '1 tsp');

-- Recipe 8: Tomato Soup (Vegetarian, Easy, Gluten-Free)
INSERT INTO Recipes VALUES (NULL, 'Tomato Soup', 'Boil tomatoes. Blend. Add spices and simmer.', 25, 'Easy', 4, NOW(), NOW());
SET @recipe_id_8 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_8, @veg_tag), (@recipe_id_8, @gf_tag), (@recipe_id_8, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_8, 150, 4, 2, 22);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_8, (SELECT ingredient_id FROM Ingredients WHERE name='Tomato'), '4 large'),
(@recipe_id_8, (SELECT ingredient_id FROM Ingredients WHERE name='Onion'), '0.5'),
(@recipe_id_8, (SELECT ingredient_id FROM Ingredients WHERE name='Salt'), '1 tsp');

-- Recipe 9: Butter Pasta (Vegetarian, Easy)
INSERT INTO Recipes VALUES (NULL, 'Butter Garlic Pasta', 'Boil pasta. Mix butter, garlic, and seasoning.', 18, 'Easy', 2, NOW(), NOW());
SET @recipe_id_9 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_9, @veg_tag), (@recipe_id_9, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_9, 420, 10, 12, 68);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_9, (SELECT ingredient_id FROM Ingredients WHERE name='Pasta'), '200g'),
(@recipe_id_9, (SELECT ingredient_id FROM Ingredients WHERE name='Butter'), '1 tbsp'),
(@recipe_id_9, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '3 cloves');

-- Recipe 10: Chicken Curry (Medium)
INSERT INTO Recipes VALUES (NULL, 'Chicken Curry', 'Cook chicken with onions, tomatoes, and spices.', 40, 'Medium', 4, NOW(), NOW());
SET @recipe_id_10 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_10, @medium_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_10, 600, 42, 20, 30);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_10, (SELECT ingredient_id FROM Ingredients WHERE name='Chicken Breast'), '500g'),
(@recipe_id_10, (SELECT ingredient_id FROM Ingredients WHERE name='Onion'), '1'),
(@recipe_id_10, (SELECT ingredient_id FROM Ingredients WHERE name='Tomato'), '2'),
(@recipe_id_10, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '4 cloves');


INSERT INTO Recipes VALUES (NULL, 'Scrambled Eggs', 'Whisk eggs. Cook with butter until fluffy.', 8, 'Easy', 2, NOW(), NOW());
SET @recipe_id_11 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_11, @veg_tag), (@recipe_id_11, @easy_tag), (@recipe_id_11, @gf_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_11, 220, 12, 10, 3);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_11, (SELECT ingredient_id FROM Ingredients WHERE name='Egg'), '2'),
(@recipe_id_11, (SELECT ingredient_id FROM Ingredients WHERE name='Butter'), '1 tbsp');

-- Recipe 12: Veg Sandwich (Vegetarian, Easy)
INSERT INTO Recipes VALUES (NULL, 'Veg Sandwich', 'Layer vegetables and toast lightly.', 12, 'Easy', 1, NOW(), NOW());
SET @recipe_id_12 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_12, @veg_tag), (@recipe_id_12, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_12, 280, 6, 8, 40);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_12, (SELECT ingredient_id FROM Ingredients WHERE name='Tomato'), '2 slices'),
(@recipe_id_12, (SELECT ingredient_id FROM Ingredients WHERE name='Onion'), '2 slices'),
(@recipe_id_12, (SELECT ingredient_id FROM Ingredients WHERE name='Salt'), '1 pinch');

-- Recipe 13: Broccoli Stir Fry (Vegetarian, Gluten-Free)
INSERT INTO Recipes VALUES (NULL, 'Broccoli Stir Fry', 'Stir fry broccoli with garlic and seasoning.', 10, 'Easy', 2, NOW(), NOW());
SET @recipe_id_13 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_13, @veg_tag), (@recipe_id_13, @gf_tag), (@recipe_id_13, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_13, 120, 4, 4, 18);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_13, (SELECT ingredient_id FROM Ingredients WHERE name='Broccoli'), '1 head'),
(@recipe_id_13, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '2 cloves');

-- Recipe 14: Egg Fried Rice (Medium)
INSERT INTO Recipes VALUES (NULL, 'Egg Fried Rice', 'Scramble eggs, add rice, mix well.', 18, 'Medium', 2, NOW(), NOW());
SET @recipe_id_14 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_14, @medium_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_14, 380, 12, 8, 58);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_14, (SELECT ingredient_id FROM Ingredients WHERE name='Egg'), '2'),
(@recipe_id_14, (SELECT ingredient_id FROM Ingredients WHERE name='Rice'), '1 cup');

-- Recipe 15: Garlic Chicken (Medium)
INSERT INTO Recipes VALUES (NULL, 'Garlic Chicken', 'Sear chicken with garlic butter sauce.', 28, 'Medium', 3, NOW(), NOW());
SET @recipe_id_15 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_15, @medium_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_15, 510, 45, 18, 10);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_15, (SELECT ingredient_id FROM Ingredients WHERE name='Chicken Breast'), '400g'),
(@recipe_id_15, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '5 cloves'),
(@recipe_id_15, (SELECT ingredient_id FROM Ingredients WHERE name='Butter'), '1 tbsp');

-- Recipe 16: Tofu Fried Rice (Vegetarian)
INSERT INTO Recipes VALUES (NULL, 'Tofu Fried Rice', 'Stir fry tofu and rice with vegetables.', 22, 'Medium', 3, NOW(), NOW());
SET @recipe_id_16 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_16, @veg_tag), (@recipe_id_16, @medium_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_16, 360, 16, 7, 50);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_16, (SELECT ingredient_id FROM Ingredients WHERE name='Tofu'), '1 block'),
(@recipe_id_16, (SELECT ingredient_id FROM Ingredients WHERE name='Rice'), '1 cup');

-- Recipe 17: Garlic Butter Chicken Pasta
INSERT INTO Recipes VALUES (NULL, 'Garlic Butter Chicken Pasta', 'Cook pasta. Sear chicken. Mix with garlic butter sauce.', 30, 'Medium', 3, NOW(), NOW());
SET @recipe_id_17 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_17, @medium_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_17, 650, 40, 15, 75);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_17, (SELECT ingredient_id FROM Ingredients WHERE name='Chicken Breast'), '300g'),
(@recipe_id_17, (SELECT ingredient_id FROM Ingredients WHERE name='Pasta'), '200g'),
(@recipe_id_17, (SELECT ingredient_id FROM Ingredients WHERE name='Garlic'), '4 cloves');

-- Recipe 18: Sweet Omelette (Vegetarian)
INSERT INTO Recipes VALUES (NULL, 'Sweet Omelette', 'Cook omelette with sugar and milk.', 12, 'Easy', 2, NOW(), NOW());
SET @recipe_id_18 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_18, @veg_tag), (@recipe_id_18, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_18, 250, 10, 6, 15);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_18, (SELECT ingredient_id FROM Ingredients WHERE name='Egg'), '2'),
(@recipe_id_18, (SELECT ingredient_id FROM Ingredients WHERE name='Milk'), '2 tbsp'),
(@recipe_id_18, (SELECT ingredient_id FROM Ingredients WHERE name='Sugar'), '1 tbsp');

-- Recipe 19: Tomato Rice
INSERT INTO Recipes VALUES (NULL, 'Tomato Rice', 'Cook rice with tomatoes and spices.', 18, 'Easy', 3, NOW(), NOW());
SET @recipe_id_19 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_19, @veg_tag), (@recipe_id_19, @easy_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_19, 330, 6, 5, 55);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_19, (SELECT ingredient_id FROM Ingredients WHERE name='Rice'), '1 cup'),
(@recipe_id_19, (SELECT ingredient_id FROM Ingredients WHERE name='Tomato'), '2'),
(@recipe_id_19, (SELECT ingredient_id FROM Ingredients WHERE name='Onion'), '1');

-- Recipe 20: Broccoli Chicken Bowl
INSERT INTO Recipes VALUES (NULL, 'Broccoli Chicken Bowl', 'Stir fry chicken and broccoli. Serve with rice.', 22, 'Medium', 2, NOW(), NOW());
SET @recipe_id_20 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_20, @medium_tag), (@recipe_id_20, @gf_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_20, 480, 42, 8, 35);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_20, (SELECT ingredient_id FROM Ingredients WHERE name='Chicken Breast'), '300g'),
(@recipe_id_20, (SELECT ingredient_id FROM Ingredients WHERE name='Broccoli'), '1 head'),
(@recipe_id_20, (SELECT ingredient_id FROM Ingredients WHERE name='Rice'), '1 cup');

-- Recipe 21: Classic Butter Toast (Vegetarian, Easy)
INSERT INTO Recipes VALUES (NULL, 'Butter Toast', 'Spread butter and toast lightly.', 5, 'Easy', 1, NOW(), NOW());
SET @recipe_id_21 = LAST_INSERT_ID();
INSERT INTO RecipeTags VALUES (@recipe_id_21, @veg_tag), (@recipe_id_21, @easy_tag), (@recipe_id_21, @gf_tag);
INSERT INTO NutritionalInfo VALUES (@recipe_id_21, 190, 2, 8, 26);
INSERT INTO RecipeIngredients VALUES
(@recipe_id_21, (SELECT ingredient_id FROM Ingredients WHERE name='Butter'), '1 tbsp'),
(@recipe_id_21, (SELECT ingredient_id FROM Ingredients WHERE name='Salt'), '1 pinch');



-- Index recipes by common filter fields
CREATE INDEX idx_cooking_time ON Recipes (cooking_time_min);
CREATE INDEX idx_difficulty ON Recipes (difficulty);

-- Index tags for fast lookup
CREATE INDEX idx_tag_name ON DietaryTags (tag_name);

-- Index the junction table lookups
CREATE INDEX idx_recipe_tags_tag_id ON RecipeTags (tag_id);

-- Index user ratings by recipe and user
CREATE INDEX idx_ratings_recipe_id ON Ratings (recipe_id);
CREATE INDEX idx_ratings_user_id ON Ratings (user_id);