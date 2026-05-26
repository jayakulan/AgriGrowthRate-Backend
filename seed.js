const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const seedAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agrigrowthrate');
    
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@gmail.com' });
    
    if (adminExists) {
      console.log('✓ Admin user already exists');
      await mongoose.disconnect();
      return;
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@gmail.com',
      password: 'password123',
      role: 'admin',
      isVerified: true,
      phone: '+1-555-0100',
      address: 'System Administrator',
    });

    console.log('✓ Admin user created successfully');
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Password: password123`);
    console.log(`  Role: ${adminUser.role}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('✗ Error seeding admin user:', error.message);
    process.exit(1);
  }
};

seedAdminUser();
