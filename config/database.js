const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: "config.env" });

const dbConnection = () => {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then((conn) => {
      console.log(`Connected to MongoDB: ${conn.connection.host}`);
    })
    .catch((err) => {
      console.error(`Error connecting to MongoDB: ${err.message}`);
      process.exit(1);
    });
};

module.exports = dbConnection;
