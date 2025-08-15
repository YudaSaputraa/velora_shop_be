import express from "express";
import { client } from "../config/connection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authorize } from "../middleware/Authorize.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    bcrypt.hash(
      password,
      parseInt(process.env.SALT_ROUNDS),
      async (err, hash) => {
        if (err) {
          res.status(500).json({
            status: false,
            message: err.message,
          });
        } else {
          const data = await client.query(
            `INSERT INTO users (name, email, phone, password) VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, email, phone, hash]
          );

          res.status(201).json({
            status: true,
            message: "success signUp",
            data: data.rows,
          });
        }
      }
    );
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    const data = await client.query(`SELECT * FROM users WHERE email=$1`, [
      email,
    ]);
    if (data.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found!",
      });
    }
    const user = data.rows[0];

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }

      if (result) {
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            level: user.level,
          },
          process.env.JWT_PRIVATE_KEY,
          { expiresIn: "5d" }
        );
        res.cookie("token", token, { httpOnly: true });
        return res.status(200).json({
          status: true,
          message: "success sign in",
          token: token,
        });
      }

      return res.status(401).json({
        status: false,
        message: "wrong email or password!",
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/load-user", authorize("user", "admin"), async (req, res) => {
  try {
    const data = await client.query(`SELECT * FROM users WHERE id=$1`, [
      req.user.id,
    ]);
    const user = data.rows[0];
    res.status(200).json({
      status: true,
      message: "success load user",
      data: user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/get-users", authorize("admin"), async (req, res) => {
  try {
    const data = await client.query(`SELECT * FROM users`);
    const user = data.rows;
    res.status(200).json({
      status: true,
      message: "success get all users",
      data: user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/delete-user/:id", authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await client.query(`DELETE FROM users WHERE id=$1`, [id]);
    res.status(200).json({
      status: true,
      message: "success delete user",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

export default router;
