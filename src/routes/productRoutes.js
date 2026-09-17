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
const uploadS3 = require('../middleware/s3Upload');

router.get('/', getProducts);
router.get('/my', protect, authorize('farmer', 'admin'), getMyProducts);
router.get('/:id', getProduct);
router.post('/', protect, authorize('farmer', 'admin'), uploadS3.array('images', 5), createProduct);
router.put('/:id', protect, authorize('farmer', 'admin'), uploadS3.array('images', 5), updateProduct);
router.delete('/:id', protect, authorize('farmer', 'admin'), deleteProduct);

module.exports = router;
