const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { s3Client } = require('../config/awsConfig');

const bucketName = process.env.AWS_S3_BUCKET_NAME || 'agrigrowthrate-bucket';

// Configure Multer with AWS S3 Storage
const uploadS3 = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const keyName = `uploads/${file.fieldname}-${uniqueSuffix}${ext}`;
      cb(null, keyName);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max file size
});

module.exports = uploadS3;
