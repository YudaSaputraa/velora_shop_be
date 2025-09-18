import express from "express";
import { client } from "../config/connection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authorize } from "../middleware/Authorize.js";

const router = express.Router();

/**
 * @swagger
 * /authentication/signup:
 *   post:
 *     summary: Sign Up
 *     description:
 *       Required for all field
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: success sign up
 *       500:
 *         description: Internal server error
 */

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

/**
 * @swagger
 * /authentication/signin:
 *   post:
 *     summary: Sign In
 *     description:
 *       Required for `email` and `password`
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: success sign in
 *       500:
 *         description: Internal server error
 */
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
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.ENV === "production",
          maxAge: 5 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
          status: true,
          message: "success sign in",
          token: token,
          data: user,
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

/**
 * @swagger
 * /authentication/load-user:
 *   get:
 *     summary: Get user data
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: success load user
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

router.get("/load-user", authorize("user", "admin"), async (req, res) => {
  try {
    const data = await client.query(
      `SELECT  users.id, users.name, users.email, users.level, users.phone,
      jsonb_build_object(
      'id', address.id,
      'address_id', address.address_id,
      'label', address.label,
      'province_name', address.province_name,
      'city_name', address.city_name,
      'distric_name', address.district_name,
      'subdistric_name', address.subdistrict_name,
      'zip_code', address.zip_code,
      'detail', address.detail) AS address
      FROM users
      LEFT JOIN address ON users.id = address.user_id
      WHERE users.id=$1`,
      [req.user.id]
    );
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
/**
 * @swagger
 * /authentication/get-users:
 *   get:
 *     summary: Get all users
 *     description:
 *       Admin only
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: success get all users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       500:
 *         description: Server error
 */

router.get("/get-users", authorize("admin"), async (req, res) => {
  try {
    let { search = "", page, limit } = req.query;
    limit = parseInt(limit);
    page = parseInt(page);
    const offset = (page - 1) * limit;

    if (!page && !limit) {
      const data = await client.query(
        `SELECT * FROM users WHERE level='user' ORDER BY LOWER(name) ASC`
      );
      const users = data.rows;
      res.status(200).json({
        status: true,
        message: "success get all users",
        data: users,
      });
    } else {
      let query = `SELECT * FROM users WHERE name ILIKE $1 AND level='user'`;
      let countQuery = `SELECT COUNT(*) AS total from users WHERE name ILIKE $1 AND level='user'`;
      let queryParams = [`%${search}%`];

      queryParams.push(limit);
      queryParams.push(offset);

      query += ` GROUP BY id ORDER BY LOWER(name) ASC LIMIT $${
        queryParams.length - 1
      } OFFSET $${queryParams.length}`;

      const data = await client.query(query, queryParams);

      const countData = await client.query(
        countQuery,
        queryParams.slice(0, queryParams.length - 2)
      );
      const totalUsers = parseInt(countData.rows[0].total);
      const totalPages = Math.ceil(totalUsers / limit);
      res.status(200).json({
        status: true,
        message: "success",
        limit,
        page,
        totalUsers,
        totalPages,
        data: data.rows,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /authentication/delete-user/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Delete a user by ID. Only accessible by admins.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       500:
 *         description: Server error
 */

router.delete("/delete-user/:id", authorize("admin"), async (req, res) => {
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

/**
 * @swagger
 * /authentication/update-profile:
 *   put:
 *     summary: Update user profile
 *     description: Update name, email, phone and password
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found!
 *       500:
 *         description: Server error
 */

router.put("/update-profile", authorize("user"), async (req, res) => {
  try {
    const { name, email, phone, oldPassword, newPassword } = req.body;

    await client.query(
      `UPDATE users SET name=$1, email=$2, phone=$3 WHERE id=$4`,
      [name, email, phone, req.user.id]
    );
    if (oldPassword && newPassword) {
      const result = await client.query(
        `SELECT password FROM users WHERE id=$1`,
        [req.user.id]
      );
      if (result.rowCount === 0) {
        res.status(404).json({
          status: false,
          message: "User not found!",
        });
      }
      const user = result.rows[0];
      const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordMatch) {
        return res.status(400).json({
          status: false,
          message: "Old password you entered is incorrect.",
        });
      }
      const hashedPassword = await bcrypt.hash(
        newPassword,
        parseInt(process.env.SALT_ROUNDS)
      );
      await client.query(`UPDATE users SET password=$1 WHERE id=$2`, [
        hashedPassword,
        req.user.id,
      ]);
    }
    res.status(200).json({
      status: true,
      message: "Data updated successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
/**
 * @swagger
 * /authentication/logout:
 *   post:
 *     summary: Logout user
 *     description: Clears the authentication token cookie and logs the user out.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       500:
 *         description: Server error
 */

router.post("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      status: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to log out",
    });
  }
});

export default router;
