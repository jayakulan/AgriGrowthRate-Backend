const dynamoose = require('dynamoose');
const { S3Client } = require('@aws-sdk/client-s3');

// AWS Region & Credentials configuration
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const awsCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'MOCK_ACCESS_KEY',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'MOCK_SECRET_KEY'
};

// Initialize Dynamoose with custom DynamoDB client if credentials exist
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  const ddb = new dynamoose.aws.ddb.DynamoDB({
    region: awsRegion,
    credentials: awsCredentials
  });
  dynamoose.aws.ddb.set(ddb);
} else {
  // Fallback to default local or environment configuration
  dynamoose.aws.ddb.local();
}

// AWS S3 Client Configuration (AWS SDK v3)
const s3Client = new S3Client({
  region: awsRegion,
  credentials: awsCredentials
});

module.exports = {
  dynamoose,
  s3Client
};
