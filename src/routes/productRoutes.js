const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', getProducts);
router.get('/my', protect, authorize('farmer', 'admin'), getMyProducts);
router.get('/:id', getProduct);
router.post('/', protect, authorize('farmer', 'admin'), createProduct);
router.put('/:id', protect, authorize('farmer', 'admin'), updateProduct);
router.delete('/:id', protect, authorize('farmer', 'admin'), deleteProduct);

module.exports = router;
