import "dotenv/config";
import app from "./app.js";
import { connectToDb } from "./config/connection.js";

app.get("/", (req, res) => {
  res.send("Server is active");
});

app.listen(process.env.PORT, async () => {
  try {
    await connectToDb();
    console.log(`Server is running on port ${process.env.PORT}`);
  } catch (error) {
    console.log(error);
  }
});
