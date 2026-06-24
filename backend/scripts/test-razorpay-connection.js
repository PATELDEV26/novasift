require('dotenv').config();
const { razorpay } = require('../lib/razorpay');

async function testConnection() {
  try {
    const plans = await razorpay.plans.all();
    console.log('✅ Razorpay connection successful');
    console.log('Plans found:', plans.items.length);
  } catch (error) {
    console.error('❌ Razorpay connection failed:', error.message);
  }
}

testConnection();
