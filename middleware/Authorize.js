import jwt from "jsonwebtoken";
import { client } from "../config/connection.js";

export const authorize = (...levels) => {
  return async (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
      return null;
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);

      //   console.log(decoded);
      const { id, level } = decoded;
      const data = await client.query(`SELECT * FROM users WHERE id =$1`, [id]);

      if (data.rowCount === 0) {
        return res.status(404).json({
          status: false,
          message: "User not found!",
        });
      }
      const user = data.rows[0];
      if (!levels.includes(user.level)) {
        return res.status(403).json({
          status: false,
          message: "Limited access",
        });
      }
      req.user = user;
      next();
    } catch (error) {
      console.log(error);
      res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  };
};
