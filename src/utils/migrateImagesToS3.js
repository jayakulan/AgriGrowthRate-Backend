require('dotenv').config();
const Product = require('../models/Product');
const User = require('../models/User');
const DiseaseScan = require('../models/DiseaseScan');
const { find } = require('./dbHelpers');
const { uploadBase64ToS3, processImagesToS3 } = require('./s3Helper');

/**
 * Scans DynamoDB tables (Product, User, DiseaseScan) and replaces
 * any stored Base64 image strings with AWS S3 public HTTPS URLs.
 */
const migrateAllImagesToS3 = async () => {
  console.log('🔄 Checking DynamoDB tables for any stored Base64 images to migrate to S3...');
  let totalMigrated = 0;

  try {
    // 1. Migrate Products
    const products = await find(Product);
    for (const prod of products) {
      if (Array.isArray(prod.images) && prod.images.length > 0) {
        const hasBase64 = prod.images.some(img => typeof img === 'string' && (img.startsWith('data:image') || (img.length > 50 && !img.startsWith('http'))));
        if (hasBase64) {
          console.log(`📦 Migrating images for Product ID: ${prod.id} (${prod.name})`);
          const newImages = await processImagesToS3(prod.images, 'products');
          await Product.update({ id: prod.id }, { images: newImages });
          totalMigrated++;
        }
      }
    }

    // 2. Migrate User Avatars
    const users = await find(User);
    for (const u of users) {
      if (u.avatar && typeof u.avatar === 'string') {
        const isBase64 = u.avatar.startsWith('data:image') || (u.avatar.length > 50 && !u.avatar.startsWith('http'));
        if (isBase64) {
          console.log(`👤 Migrating avatar for User ID: ${u.id} (${u.name})`);
          const s3Avatar = await uploadBase64ToS3(u.avatar, 'avatars');
          await User.update({ id: u.id }, { avatar: s3Avatar });
          totalMigrated++;
        }
      }
    }

    // 3. Migrate Disease Scans
    const scans = await find(DiseaseScan);
    for (const scan of scans) {
      if (scan.image && typeof scan.image === 'string') {
        const isBase64 = scan.image.startsWith('data:image') || (scan.image.length > 50 && !scan.image.startsWith('http'));
        if (isBase64) {
          console.log(`🔬 Migrating image for Disease Scan ID: ${scan.id}`);
          const s3Image = await uploadBase64ToS3(scan.image, 'disease-scans');
          await DiseaseScan.update({ id: scan.id }, { image: s3Image });
          totalMigrated++;
        }
      }
    }

    if (totalMigrated > 0) {
      console.log(`✅ Successfully migrated ${totalMigrated} item(s) with Base64 images to AWS S3!`);
    } else {
      console.log('✅ DynamoDB check complete: All images are already using S3 URLs!');
    }
  } catch (error) {
    console.error('❌ Error during Base64 image migration to S3:', error.message);
  }
};

if (require.main === module) {
  migrateAllImagesToS3();
}

module.exports = migrateAllImagesToS3;
