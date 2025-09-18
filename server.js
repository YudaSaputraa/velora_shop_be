import "dotenv/config";
import app from "./app.js";
import { connectToDb } from "./config/connection.js";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerOptions = {
  definition: {
    openapi: "3.1.1",
    info: {
      title: "RESTful API Documentation",
      version: "1.0.0",
      description: "RESTful API documentaion of Velora shop",
    },
    servers: [
      {
        url: "http://localhost:4005",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./router/*.js"],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.send("Server is active");
});

app.listen(process.env.PORT, async () => {
  try {
    await connectToDb();
    console.log(`Server is running on port ${process.env.PORT}`);
    console.log(
      `Swagger docs at http://localhost:${process.env.PORT}/api-docs`
    );
  } catch (error) {
    console.log(error);
  }
});
