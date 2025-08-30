import express from "express";
import { client } from "../config/connection.js";
import { authorize } from "../middleware/Authorize.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./assets/icons");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, "-");

    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage: storage });

const router = express.Router();

router.post(
  "/add-category",
  authorize("admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, id } = req.body;
      let image = null;
      if (req.file) {
        image = `${process.env.URL}/assets/icons/${req.file.filename}`;
      }

      if (id) {
        if (name && image) {
          await client.query(
            `UPDATE category SET name = $1, image = $2 WHERE id = $3 RETURNING *`,
            [name, image, id]
          );
        } else if (name) {
          await client.query(
            `UPDATE category SET name = $1 WHERE id = $2 RETURNING *`,
            [name, id]
          );
        } else if (image) {
          await client.query(
            `UPDATE category SET image = $1 WHERE id = $2 RETURNING *`,
            [image, id]
          );
        }
      } else {
        if (name && image) {
          await client.query(
            `INSERT INTO category (name, image) VALUES ($1, $2)`,
            [name, image]
          );
        } else {
          await client.query(`INSERT INTO category (name) VALUES ($1)`, [name]);
        }
      }

      res.status(200).json({
        status: true,
        message: id ? "Success update category" : "Success add category",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.get("/get-categories", async (req, res) => {
  try {
    let { search = "", page, limit } = req.query;
    limit = parseInt(limit);
    page = parseInt(page);
    const offset = (page - 1) * limit;

    if (!page && !limit) {
      const data = await client.query(
        `SELECT * FROM category ORDER BY name ASC`
      );
      const categories = data.rows;
      res.status(200).json({
        status: true,
        message: "success",
        data: categories,
      });
    } else {
      let query = `SELECT * FROM category WHERE name ILIKE $1`;
      let countQuery = `SELECT COUNT(*) AS total FROM category WHERE name ILIKE $1`;
      let queryParams = [`%${search}%`];

      queryParams.push(limit);
      queryParams.push(offset);

      query += ` GROUP BY id ORDER BY name ASC LIMIT $${
        queryParams.length - 1
      } OFFSET $${queryParams.length}`;

      const data = await client.query(query, queryParams);

      const countData = await client.query(
        countQuery,
        queryParams.slice(0, queryParams.length - 2)
      );
      const totalCategory = parseInt(countData.rows[0].total);
      const totalPages = Math.ceil(totalCategory / limit);

      res.status(200).json({
        status: true,
        message: "success",
        totalCategory,
        totalPages,
        data: data.rows,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: false, message: error.message });
  }
});

router.delete("/delete/:id", authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    await client.query(`DELETE FROM category WHERE id=$1`, [id]);
    res.status(200).json({
      status: true,
      message: "delete success",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
