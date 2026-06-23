const swaggerSpec = require("../src/config/swagger");

console.log("=== Swagger Verification ===");
console.log("Tags:", swaggerSpec.tags.length);
console.log("Schemas:", Object.keys(swaggerSpec.components.schemas).length);
console.log("Paths found:", Object.keys(swaggerSpec.paths).length);

console.log("\n=== Discovered API Endpoints ===");
Object.entries(swaggerSpec.paths).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, details]) => {
    console.log(`  ${method.toUpperCase()} /api/v1${path} - ${details.summary || "No summary"}`);
  });
});

console.log("\n=== Schema Names ===");
Object.keys(swaggerSpec.components.schemas).forEach(name => {
  console.log(`  - ${name}`);
});

console.log("\n✅ Swagger configuration verified successfully!");