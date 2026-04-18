const express   = require('express');
const router    = express.Router();
const { body, validationResult } = require('express-validator');
const { register, login, refreshToken, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
    body('phone').isMobilePhone().withMessage('Valid phone required'),
    body('role').optional().isIn(['user', 'provider']).withMessage('Invalid role'),
  ],
  validate,
  register
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

router.post('/refresh', refreshToken);
router.post('/logout',  logout);
router.get('/me',  protect, getMe);

module.exports = router;