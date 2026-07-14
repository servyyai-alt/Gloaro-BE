const mongoose = require("mongoose");

async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    // Fallback ONLY allowed in development for standalone Mongo instances that do not support replica sets
    if (process.env.NODE_ENV !== "production") {
      if (
        error.codeName === "CommandNotSupportedOnReplicaSet" ||
        error.message.includes("Transaction numbers are only allowed") ||
        error.code === 20
      ) {
        console.warn("MongoDB replica set transaction not supported. Falling back to standard execution.");
        return await fn(null);
      }
    }
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = { runInTransaction };
