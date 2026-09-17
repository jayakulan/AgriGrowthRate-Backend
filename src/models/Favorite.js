const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const favoriteSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    consumerId: {
      type: String,
      required: true,
      index: {
        name: 'consumerFavoriteIndex',
        global: true
      }
    },
    farmerId: { type: String, required: true }
  },
  { timestamps: true }
);

const Favorite = dynamoose.model('Favorite', favoriteSchema, {
  create: true,
  waitForActive: false
});

module.exports = Favorite;
