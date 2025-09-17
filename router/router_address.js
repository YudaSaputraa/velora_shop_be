import "dotenv/config";
import express from "express";
import { client } from "../config/connection.js";
import { authorize } from "../middleware/Authorize.js";

const router = express.Router();
const api_key = process.env.BINDER_BYTE_API_KEY;

router.get(
  "/get-cities/:city",
  authorize("admin", "user"),
  async (req, res) => {
    try {
      const options = {
        method: "GET",
        headers: {
          accept: "application/json",
          key: process.env.RAJAONGKIR_SHIPPING_COST_API_KEY,
        },
      };
      const response = await fetch(
        `https://rajaongkir.komerce.id/api/v1/destination/domestic-destination?search=${req.params.city}&limit=100000`,
        options
      );
      const data = await response.json();
      const sorted = data.data.sort((a, b) =>
        a.province_name.localeCompare(b.name)
      );

      res.status(200).json(sorted);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.get("/cost", authorize("user"), async (req, res) => {
  try {
    const { courier, origin = "8112", destination, weight } = req.query;

    const formData = new URLSearchParams();
    formData.append("courier", courier);
    formData.append("origin", origin);
    formData.append("destination", destination);
    formData.append("weight", weight);

    const options = {
      method: "POST",
      headers: {
        accept: "application/x-www-form-urlencoded",
        key: process.env.RAJAONGKIR_SHIPPING_COST_API_KEY,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    };

    const response = await fetch(
      `https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost`,
      options
    );
    const data = await response.json();

    res.status(200).json(data.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/get-provinces", authorize("user"), async (req, res) => {
  try {
    const response = await fetch(
      `https://api.binderbyte.com/wilayah/provinsi?api_key=${api_key}`
    );

    const data = await response.json();
    const sorted = data.value.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json(sorted);
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
      address_id,
      label,
      province_name,
      city_name,
      district_name,
      subdistrict_name,
      zip_code,
      detail,
    } = req.body;
    const user_id = req.user.id;

    if (id) {
      await client.query(
        `UPDATE address SET
          address_id = $1,
          label = $2,
          province_name = $3,
          city_name = $4,
          district_name = $5,
          subdistrict_name = $6,
          zip_code = $7,
          detail = $8
        WHERE id = $9`,
        [
          address_id,
          label,
          province_name,
          city_name,
          district_name,
          subdistrict_name,
          zip_code,
          detail,
          id,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO address (
          user_id,
          address_id,
          label,
          province_name,
          city_name,
          district_name,
          subdistrict_name,
          zip_code,
          detail
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          user_id,
          address_id,
          label,
          province_name,
          city_name,
          district_name,
          subdistrict_name,
          zip_code,
          detail,
        ]
      );
    }

    res.status(201).json({
      status: true,
      message: id ? "success update address" : "success added the address",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
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
