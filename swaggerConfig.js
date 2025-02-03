const swaggerJsdoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Contacts Api",
      version: "1.0.0",
      description: "API documentation for your Contacts App",
    },
    servers: [
      {
        url: "http://localhost:3000", // Replace with your server URL
      },
    ],
  },
  apis: ["./routes/*.js"], // Adjust path as needed to point to your route files
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

module.exports = swaggerDocs;
