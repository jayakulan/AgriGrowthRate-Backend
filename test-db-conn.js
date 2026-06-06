const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB successfully!");
  } catch(e) {
    console.error("Connection failed:", e.message);
  }
  process.exit(0);
}
test();
