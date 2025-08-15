import "dotenv/config";
import express from "express";
import axios from "axios";
import { authorize } from "../middleware/Authorize.js";
import { nanoid } from "nanoid";
import { client } from "../config/connection.js";

const router = express.Router();

router.post("/create-cart", authorize("user"), async (req, res) => {
  try {
    const { products } = req.body;
    const user = req.user;

    await client.query("BEGIN");

    const cartRes = await client.query(
      `INSERT INTO cart (user_id) VALUES ($1) RETURNING *`,
      [user.id]
    );
    const cart = cartRes.rows[0];

    for (const product of products) {
      await client.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [cart.id, product.id, product.quantity, product.price]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      status: true,
      message: "Cart created successfully",
      data: {
        cart_id: cart.id,
        products,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/get-carts", authorize("user"), async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT cart.*, users.name AS user_name, users.email, users.phone,
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', product.id,
            'name', product.name,
            'quantity', cart_items.quantity,
            'price', cart_items.price
          )
        ) FILTER (WHERE product.id IS NOT NULL), '[]'
      ) AS products
      FROM cart
      INNER JOIN users ON cart.user_id = users.id
      INNER JOIN cart_items ON cart.id = cart_items.cart_id
      INNER JOIN product ON cart_items.product_id = product.id
      WHERE cart.user_id = $1
      GROUP BY cart.id, users.id
    `;

    const result = await client.query(query, [userId]);

    res.status(200).json({
      status: true,
      message: "Success get carts",
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.delete("/delete-cart/:id", authorize("user"), async (req, res) => {
  try {
    const { id } = req.params;

    await client.query("BEGIN");
    await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [id]);
    await client.query(`DELETE FROM cart WHERE id = $1`, [id]);
    await client.query("COMMIT");

    res.status(200).json({
      status: true,
      message: "Cart deleted successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

export default router;
