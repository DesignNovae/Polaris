const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://PolarisProject:v9sLn9J43fxdQqEl@cluster0.lfq2stn.mongodb.net/?appName=Cluster0";

async function testConnection() {
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
