const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

// Load .env.local manually
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env.local");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB cluster!");
    
    const db = client.db("polaris");
    const collections = await db.listCollections().toArray();
    console.log("✅ Successfully accessed 'polaris' database!");
    console.log(`Found ${collections.length} collections.`);
    
    await client.close();
    console.log("Connection test passed.");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:");
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
