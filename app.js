import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import bodyParser from "body-parser";
import routerCategory from "./router/router_category.js";
import routerProduct from "./router/router_product.js";
import routerAuth from "./router/router_auth.js";
import routerAddress from "./router/router_address.js";
import routerUserReview from "./router/router_user_review.js";
import routerOrder from "./router/router_order.js";
import routerCart from "./router/router_cart.js";
import path from "path";
import { connectToDb } from "./config/connection.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(
  cors({
    origin: [
      process.env.DOMAIN_1,
      process.env.DOMAIN_2,
      process.env.DOMAIN_FR,
      process.env.DOMAIN_3,
      process.env.DOMAIN_4,
      process.env.DOMAIN_5,
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/category", routerCategory);
app.use("/product", routerProduct);
app.use("/authentication", routerAuth);
app.use("/address", routerAddress);
app.use("/review", routerUserReview);
app.use("/order", routerOrder);
app.use("/cart", routerCart);

if (process.env.NODE_ENV !== "vercel") {
  app.listen(process.env.PORT || 4000, async () => {
    try {
      await connectToDb();
      console.log(`🚀 Server is running on port ${process.env.PORT}`);
    } catch (error) {
      console.log(error);
    }
  });
}

export default app;
