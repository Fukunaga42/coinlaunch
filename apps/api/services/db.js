const mongoose = require('mongoose');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: 'yourDatabaseName', // optional, or get from MONGO_URI
        });
        console.log('✅ MongoDB connected via Mongoose');
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err);
        process.exit(1);
    }
}

module.exports = { connectDB };
