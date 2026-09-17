const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/awsConfig');

const bucketName = process.env.AWS_S3_BUCKET_NAME || 'agrigrowthrate-storage-bucket';
const region = process.env.AWS_REGION || 'us-east-1';

/**
 * Uploads a base64 image string to AWS S3 and returns the public HTTPS URL
 */
const uploadBase64ToS3 = async (base64Str, folder = 'uploads') => {
  if (!base64Str || typeof base64Str !== 'string') return base64Str;

  // If already an HTTP / HTTPS S3 URL, external URL, or blob URL, return as is
  if (base64Str.startsWith('http://') || base64Str.startsWith('https://') || base64Str.startsWith('blob:')) {
    return base64Str;
  }

  let contentType = 'image/jpeg';
  let ext = 'jpg';
  let rawBase64 = '';

  if (base64Str.startsWith('data:image')) {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      contentType = matches[1];
      ext = contentType.split('/')[1] || 'jpg';
      rawBase64 = matches[2];
    } else {
      return base64Str;
    }
  } else if (base64Str.length > 50 && !/\s/.test(base64Str)) {
    // Detect raw base64 image strings without data URL header
    if (base64Str.startsWith('/9j/')) {
      contentType = 'image/jpeg';
      ext = 'jpg';
    } else if (base64Str.startsWith('iVBORw0KGgo')) {
      contentType = 'image/png';
      ext = 'png';
    } else if (base64Str.startsWith('R0lGOD')) {
      contentType = 'image/gif';
      ext = 'gif';
    } else if (base64Str.startsWith('UklGR')) {
      contentType = 'image/webp';
      ext = 'webp';
    } else if (base64Str.startsWith('PHN2Zy')) {
      contentType = 'image/svg+xml';
      ext = 'svg';
    } else {
      // Default fallback if long base64 string
      contentType = 'image/jpeg';
      ext = 'jpg';
    }
    rawBase64 = base64Str;
  } else {
    return base64Str;
  }

  try {
    const buffer = Buffer.from(rawBase64, 'base64');
    const key = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });

    await s3Client.send(command);

    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    console.log(`📸 Base64 Image uploaded to S3: ${s3Url}`);
    return s3Url;
  } catch (error) {
    console.error('❌ Error uploading base64 image to AWS S3:', error.message);
    return base64Str;
  }
};

/**
 * Helper to process an array of images and upload base64 images to AWS S3
 */
const processImagesToS3 = async (imagesArray, folder = 'products') => {
  if (!Array.isArray(imagesArray)) return [];
  return await Promise.all(
    imagesArray.map((img) => uploadBase64ToS3(img, folder))
  );
};

module.exports = {
  uploadBase64ToS3,
  processImagesToS3
};
