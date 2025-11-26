const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredientController');
const uploadMiddleware = require('../middleware/upload'); 

router.post('/recognize', uploadMiddleware, ingredientController.recognizeIngredients);
router.get('/substitute', ingredientController.getSubstitution);
router.get('/substitute/bulk', ingredientController.getBulkSubstitutions);
router.get('/validate', ingredientController.validateIngredients);

module.exports = router;