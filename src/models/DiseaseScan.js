const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const diseaseScanSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true,
    default: () => uuidv4()
  },
  user: {
    type: String,
    required: true,
    index: {
      name: 'userIndex',
      global: true
    }
  },
  crop: { type: String, required: true },
  diseaseName: { type: String, required: true },
  confidence: { type: Number, required: true },
  treatment: { type: String, required: true },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100&h=100&fit=crop'
  }
}, {
  timestamps: true
});

const DiseaseScan = dynamoose.model('DiseaseScan', diseaseScanSchema, {
  create: true,
  waitForActive: false
});

module.exports = DiseaseScan;
