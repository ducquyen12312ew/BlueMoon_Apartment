// tests/setup-test-db.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function setupTestDatabase() {
  console.log('🔧 Setting up test database...');
  
  try {
    // Start MongoDB Memory Server
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    console.log('📦 MongoDB Memory Server started');
    console.log('🔗 Connection URI:', mongoUri);
    
    // Test connection
    const connection = await mongoose.createConnection(mongoUri);
    console.log('✅ Test connection successful');
    
    // Close test connection
    await connection.close();
    
    // Stop memory server
    await mongoServer.stop();
    
    console.log('🎉 Test database setup completed successfully!');
    console.log('');
    console.log('Now you can run tests with:');
    console.log('  npm test');
    console.log('  npm run test:auth');
    console.log('  npm run test:watch');
    
  } catch (error) {
    console.error('❌ Test database setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupTestDatabase();
}

module.exports = { setupTestDatabase };