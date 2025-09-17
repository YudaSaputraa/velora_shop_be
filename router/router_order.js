import "dotenv/config";
import express from "express";
import axios from "axios";
import { authorize } from "../middleware/Authorize.js";
import { nanoid } from "nanoid";
import { client } from "../config/connection.js";

const router = express.Router();

const baseUrl = process.env.MID_BASE_URL;

const config = {
  Authorization: `Basic ${Buffer.from(
    process.env.MID_SERVER_KEY + ":"
  ).toString("base64")}`,
};
router.post("/create-order", authorize("user"), async (req, res) => {
  try {
    const { products, gross_amount, shipping } = req.body;

    const user = req.user;
    const productsData = products;
    const orderId = `ORDER-${nanoid(5)}-${nanoid(5)} `;

    await client.query(`BEGIN`);

    const rawData = await client.query(
      `INSERT INTO orders (transaction_id, user_id, gross_amount)
      VALUES ($1, $2, $3) RETURNING *`,
      [orderId, user.id, gross_amount]
    );
    const order = rawData.rows[0];

    for (const product of productsData) {
      await client.query(
        `INSERT INTO order_items(order_id, product_id, quantity, price, shipping)
        VALUES ($1, $2, $3, $4, $5)`,
        [order.id, product.id, product.quantity, product.price, shipping]
      );
    }
    await client.query(`COMMIT`);
    const data = {
      customer_details: {
        first_name: user.name,
        email: user.email,
        phone: user.phone,
      },
      transaction_details: { order_id: orderId, gross_amount: gross_amount },
      credit_card: { secure: true },
      callbacks: {
        finish: `${process.env.DOMAIN1}/user-transaksi`,
      },
    };

    const response = await axios.post(`${baseUrl}/snap/v1/transactions`, data, {
      headers: config,
    });

    res.status(201).json(response.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

const updatePaymentStatus = async (status, orderId) => {
  await client.query(
    `UPDATE orders SET transaction_status = $1 WHERE transaction_id =$2`,
    [status, orderId]
  );
};

router.post("/transaction-notification", async (req, res) => {
  try {
    const data = req.body;

    let orderId = data.order_id;
    let transactionStatus = data.transaction_status;
    let fraudStatus = data.fraud_status;

    // Sample transactionStatus handling logic

    if (transactionStatus == "capture") {
      if (fraudStatus == "accept") {
        // TODO set transaction status on your database to 'success'
        // and response with 200 OK
        updatePaymentStatus(transactionStatus, orderId);
      }
    } else if (transactionStatus == "settlement") {
      // TODO set transaction status on your database to 'success'
      // and response with 200 OK
      updatePaymentStatus(transactionStatus, orderId);
    } else if (
      transactionStatus == "cancel" ||
      transactionStatus == "deny" ||
      transactionStatus == "expire"
    ) {
      // TODO set transaction status on your database to 'failure'
      // and response with 200 OK
      updatePaymentStatus(transactionStatus, orderId);
    } else if (transactionStatus == "pending") {
      // TODO set transaction status on your database to 'pending' / waiting payment
      // and response with 200 OK
      updatePaymentStatus(transactionStatus, orderId);
    }

    res.status(200).json({
      status: true,
      message: "OK",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.put("/confirm/:orderId", authorize("admin"), async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = "processing";

    const checkOrder = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const order = checkOrder.rows[0];

    const checkProduct = await client.query(
      `SELECT * FROM product WHERE id = $1`,
      [order.product_id]
    );

    const product = checkProduct.rows[0];
    const updateStock = product.stock - order.quantity;

    await client.query(`UPDATE product SET stock = $1 WHERE id =$2 `, [
      updateStock,
      product.id,
    ]);

    await client.query(`UPDATE orders SET status_order = $1 WHERE id =$2 `, [
      status,
      orderId,
    ]);

    res.status(200).json({
      status: true,
      message: "order confirmed and status updated",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.put("/give-resi", authorize("admin"), async (req, res) => {
  try {
    const { id, resi } = req.body;
    const status = "shipping";

    await client.query(
      `UPDATE orders SET resi = $1, status_order =$2 WHERE id =$3 `,
      [resi, status, id]
    );
    res.status(200).json({
      status: true,
      message: "Tracking number has been updated",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.put("/cancel-order/:orderId", authorize("admin"), async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = "rejected";

    await client.query(`UPDATE orders SET status_order =$1 WHERE id =$2 `, [
      status,
      orderId,
    ]);
    res.status(200).json({
      status: true,
      message: "Order has been rejected",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/get-orders", authorize("admin", "user"), async (req, res) => {
  try {
    const role = req.user.level;
    const userId = req.user.id;
    const { search = "", page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Hitung total data
    const countQuery = `
      SELECT COUNT(*) 
      FROM orders
      INNER JOIN users ON orders.user_id = users.id
      WHERE (orders.transaction_id ILIKE $1 OR users.name ILIKE $1)
      ${role !== "admin" ? "AND orders.user_id = $2" : ""}
    `;
    const countParams =
      role !== "admin" ? [`%${search}%`, userId] : [`%${search}%`];
    const countResult = await client.query(countQuery, countParams);
    const totalData = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalData / limit);

    const baseQuery = `
      SELECT 
        orders.id,
        orders.transaction_id,
        orders.transaction_status,
        orders.status_order,
        orders.gross_amount,
        orders.resi,
        orders.created_at,
        users.id AS user_id,
        users.name AS user_name,
        users.email,
        users.phone,
        address.id AS address_id,
        address.label,
        address.province_name,
        address.city_name,
        address.district_name,
        address.subdistrict_name,
        address.detail,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', product.id,
              'name', product.name,
              'quantity', order_items.quantity,
              'price', order_items.price,
              'capital', order_items.quantity * product.capital,
              'profit', (order_items.price - (order_items.quantity * product.capital)),
              'shipping', order_items.shipping,
              'images', (
                SELECT json_agg(img.link)
                FROM image img
                WHERE img.product_id = product.id
              )
            )
          ) FILTER (WHERE product.id IS NOT NULL), '[]'
        ) AS products
      FROM orders
      INNER JOIN users ON orders.user_id = users.id
      INNER JOIN order_items ON orders.id = order_items.order_id
      INNER JOIN product ON order_items.product_id = product.id
      INNER JOIN address ON users.id = address.user_id
      WHERE (orders.transaction_id ILIKE $1 OR users.name ILIKE $1)
      ${role !== "admin" ? "AND orders.user_id = $2" : ""}
      GROUP BY 
        orders.id, users.id, address.id
      ORDER BY orders.created_at DESC
      LIMIT $${role !== "admin" ? 3 : 2} OFFSET $${role !== "admin" ? 4 : 3}
    `;

    const baseParams =
      role !== "admin"
        ? [`%${search}%`, userId, limit, offset]
        : [`%${search}%`, limit, offset];

    const data = await client.query(baseQuery, baseParams);

    const orders = data.rows.map((order) => ({
      id: order.id,
      transaction_id: order.transaction_id,
      transaction_status: order.transaction_status,
      status_order: order.status_order,
      resi: order.resi,
      user: {
        user_id: order.user_id,
        name: order.user_name,
        email: order.email,
        phone: order.phone,
      },
      product: order.products.map((product) => ({
        id: product.id,
        name: product.name,
        quantity: product.quantity,
        price: product.price,
        shipping: product.shipping,
        profit: role !== "admin" ? null : product.profit,
        capital: role !== "admin" ? null : product.capital,
        img: product.images[0],
      })),
      gross_amount: Number(order.gross_amount),
      address: {
        label: order.label,
        province_name: order.province_name,
        city_name: order.city_name,
        district_name: order.district_name,
        subdistrict_name: order.subdistrict_name,
        detail: order.detail,
        shipping: Number(order.shipping),
      },
      created_at: order.created_at,
    }));

    res.status(200).json({
      status: true,
      message: "Success get orders",
      totalData,
      totalPages,
      currentPage: Number(page),
      data: orders,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/profit", authorize("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `SELECT COUNT(*) FROM orders WHERE transaction_id ILIKE $1`,
      [`%${search}%`]
    );
    const totalData = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalData / limit);

    const transactionResult = await client.query(
      `SELECT id, transaction_id FROM orders WHERE transaction_id ILIKE $1 LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );
    const transactions = transactionResult.rows;
    let result = [];

    for (let transaction of transactions) {
      const orderItemsResult = await client.query(
        `
        SELECT order_items.product_id, order_items.quantity, product.name, product.price, product.capital, product.profit
        FROM order_items JOIN product ON order_items.product_id =product.id
        WHERE order_items.order_id = $1`,
        [transaction.id]
      );

      const products = orderItemsResult.rows.map((item) => ({
        name: item.name,
        price: item.price,
        capital: item.capital,
        profit: item.profit * item.quantity,
      }));

      const totalProfit = products.reduce((acc, item) => acc + item.profit, 0);
      result.push({
        transaction_id: transaction.transaction_id,
        products,
        total_profit: totalProfit,
      });
    }
    res.status(200).json({
      status: true,
      message: "Profit data retrieved",
      totalData,
      totalPages,
      data: result,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

router.get("/order-summary", authorize("admin"), async (req, res) => {
  try {
    const data = await client.query(
      `SELECT DATE(orders.created_at) AS order_date, SUM(order_items.price) AS total_price
      FROM orders
      JOIN order_items ON orders.id = order_items.order_id
      WHERE orders.transaction_status ='settlement'
      AND orders.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY order_date ORDER BY order_date ASC`
    );
    res.status(200).json({
      status: true,
      message:
        "Order data retrieved for the last 7 days with settlement status",
      data: data.rows,
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
