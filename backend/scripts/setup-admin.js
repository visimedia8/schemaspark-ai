#!/usr/bin/env node

/**
 * Admin Setup Script for SchemaSpark
 *
 * This script helps you create your first admin account securely.
 * Run this script to set up your personal admin account.
 *
 * Usage:
 *   cd backend
 *   node scripts/setup-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// User schema (simplified for setup)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupAdmin() {
  try {
    console.log('🚀 SchemaSpark Admin Setup');
    console.log('==========================\n');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('❌ Admin account already exists!');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log('   If you need to reset, please delete the admin user from the database first.\n');
      process.exit(1);
    }

    // Get admin details
    const email = await askQuestion('Enter admin email: ');
    if (!email || !email.includes('@')) {
      console.log('❌ Invalid email address');
      process.exit(1);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Email already registered. Please use a different email.');
      process.exit(1);
    }

    const password = await askQuestion('Enter admin password (min 8 characters): ');
    if (!password || password.length < 8) {
      console.log('❌ Password must be at least 8 characters long');
      process.exit(1);
    }

    const confirmPassword = await askQuestion('Confirm password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    console.log('👤 Creating admin account...');
    const adminUser = new User({
      email,
      passwordHash,
      role: 'admin',
      isActive: true
    });

    await adminUser.save();

    console.log('\n✅ Admin account created successfully!');
    console.log('==============================');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Role: admin`);
    console.log(`📅 Created: ${adminUser.createdAt}`);
    console.log('\n🔐 Security Recommendations:');
    console.log('• Change the ADMIN_REGISTRATION_TOKEN in your .env file');
    console.log('• Use a strong, unique password');
    console.log('• Enable 2FA if available');
    console.log('• Regularly update your password');
    console.log('\n🎉 You can now log in to your SchemaSpark application!');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
  }
}

// Connect to database and run setup
async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schemaspark';

    console.log('🔌 Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Database connected\n');

    await setupAdmin();

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('• MongoDB is running');
    console.log('• MONGODB_URI is correct in your .env file');
    console.log('• Network connectivity is available');
    process.exit(1);
  }
}

main();