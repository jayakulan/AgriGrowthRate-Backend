const { dynamoose } = require('./awsConfig');
const migrateAllImagesToS3 = require('../utils/migrateImagesToS3');

const connectDB = async () => {
  try {
    const region = process.env.AWS_REGION || 'us-east-1';
    console.log(`✅ AWS DynamoDB & S3 Initialized (Region: ${region})`);
    
    // Background task to ensure no raw Base64 images stay in DynamoDB
    migrateAllImagesToS3().catch(console.error);
  } catch (error) {
    console.error(`❌ AWS DynamoDB Initialization Error: ${error.message}`);
  }
};

module.exports = connectDB;
