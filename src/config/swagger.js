const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Business Networking & Vendor Directory API",
      version: "1.0.0",
      description: "Enterprise-grade API for Business Networking & Vendor Directory Platform",
      contact: { name: "Least Action Company", email: "support@leastaction.in" },
    },
    servers: [
      { url: "http://localhost:5000/api/v1", description: "Development server" },
      { url: "https://api.vendordirectory.com/api/v1", description: "Production server" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            currentPage: { type: "integer" },
            totalPages: { type: "integer" },
            totalItems: { type: "integer" },
            itemsPerPage: { type: "integer" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
