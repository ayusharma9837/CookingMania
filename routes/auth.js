
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');


router.post('/register', authController.register);


router.post('/login', authController.login);


const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, authController.getMe); 

module.exports = router;