import "dotenv/config";
import express from "express";
import { client } from "../config/connection.js";
import { authorize } from "../middleware/Authorize.js";

const router = express.Router();
const api_key = process.env.BINDER_BYTE_API_KEY;

router.get("/get-provinces", authorize("user"), async (req, res) => {
  try {
    const response = await fetch(
      `https://api.binderbyte.com/wilayah/provinsi?api_key=${api_key}`
    );

    const data = await response.json();

    res.status(200).json(data.value);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get("/get-city/:provinceId", authorize("user"), async (req, res) => {
  try {
    const { provinceId } = req.params;
    const response = await fetch(
      `https://api.binderbyte.com/wilayah/kabupaten?api_key=${api_key}&id_provinsi=${provinceId}`
    );

    const data = await response.json();

    res.status(200).json(data.value);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/get-district/:cityId", authorize("user"), async (req, res) => {
  try {
    const { cityId } = req.params;
    const response = await fetch(
      `https://api.binderbyte.com/wilayah/kecamatan?api_key=${api_key}&id_kabupaten=${cityId}`
    );

    const data = await response.json();

    res.status(200).json(data.value);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get("/get-village/:districtId", authorize("user"), async (req, res) => {
  try {
    const { districtId } = req.params;
    const response = await fetch(
      `https://api.binderbyte.com/wilayah/kelurahan?api_key=${api_key}&id_kecamatan=${districtId}`
    );

    const data = await response.json();

    res.status(200).json(data.value);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/add-address", authorize("user"), async (req, res) => {
  try {
    const {
      id,
      province_id,
      province,
      city_id,
      city,
      district_id,
      district,
      village_id,
      village,
      detail,
    } = req.body;
    const user_id = req.user.id;
    if (id) {
      await client.query(
        `UPDATE address SET
    province_id = $1,
    province = $2,
    city_id = $3,
    city = $4,
    district_id = $5,
    district = $6,
    village_id = $7,
    village = $8
    detail = $9
   WHERE id = $10`,
        [
          province_id,
          province,
          city_id,
          city,
          district_id,
          district,
          village_id,
          village,
          detail,
          id,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO address (
      user_id,
      province_id,
      province,
      city_id,
      city,
      district_id,
      district,
      village_id,
      village,
      detail
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user_id,
          province_id,
          province,
          city_id,
          city,
          district_id,
          district,
          village_id,
          village,
          detail,
        ]
      );
    }

    res.status(201).json({
      status: true,
      message: id ? "success update address" : "success added the address",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", authorize("user"), async (req, res) => {
  try {
    const { id } = req.params;
    await client.query(`DELETE FROM address WHERE id=$1`, [id]);

    res.status(201).json({
      status: true,
      message: "success delete address",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/get-address/:userId", authorize("user"), async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await client.query(`SELECT * FROM address WHERE user_id =$1`, [
      userId,
    ]);
    const address = data.rows;

    res.status(200).json({
      status: true,
      message: "success get address by user id",
      data: address,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
export default router;
