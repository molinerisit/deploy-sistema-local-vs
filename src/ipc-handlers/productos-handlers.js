// En: src/ipc-handlers/productos-handlers.js
const { ipcMain, app } = require("electron");
const path = require("path");
const fs = require("fs/promises");

function registerProductosHandlers(models, sequelize) {
  const { Producto, ProductoDepartamento, ProductoFamilia } = models;

  // Lista de productos con familia+departamento (orden jerárquico)
  ipcMain.handle("get-productos", async () => {
    try {
      const productos = await Producto.findAll({
        include: [
          {
            model: ProductoFamilia,
            as: "familia",
            required: false,
            include: [
              {
                model: ProductoDepartamento,
                as: "departamento",
                required: false,
              },
            ],
          },
        ],
        order: [
          [
            { model: ProductoFamilia, as: "familia" },
            { model: ProductoDepartamento, as: "departamento" },
            "nombre",
            "ASC",
          ],
          [{ model: ProductoFamilia, as: "familia" }, "nombre", "ASC"],
          ["nombre", "ASC"],
        ],
      });
      return productos.map((p) => p.toJSON());
    } catch (error) {
      console.error("Error en get-productos:", error);
      return [];
    }
  });

  // Producto por ID (incluye familia+departamento)
  ipcMain.handle("get-producto-by-id", async (_event, productoId) => {
    try {
      const producto = await Producto.findByPk(productoId, {
        include: [
          {
            model: ProductoFamilia,
            as: "familia",
            required: false,
            include: [
              {
                model: ProductoDepartamento,
                as: "departamento",
                required: false,
              },
            ],
          },
        ],
      });
      return producto ? producto.toJSON() : null;
    } catch (error) {
      console.error("Error en get-producto-by-id:", error);
      return null;
    }
  });

  // Catálogo (departamentos + familias)
  ipcMain.handle("get-clasificaciones", async () => {
    try {
      const [departamentos, familias] = await Promise.all([
        ProductoDepartamento.findAll({ order: [["nombre", "ASC"]], raw: true }),
        ProductoFamilia.findAll({ order: [["nombre", "ASC"]], raw: true }),
      ]);
      return { departamentos, familias };
    } catch (error) {
      console.error("Error en get-clasificaciones:", error);
      return { departamentos: [], familias: [] };
    }
  });

  // Crear/editar producto (con imagen opcional en base64)
  ipcMain.handle("guardar-producto", async (_event, productoData) => {
    const t = await sequelize.transaction();
    try {
      // Normalización de campos numéricos y strings
      const payload = { ...productoData };
      payload.nombre = String(payload.nombre || "").trim();
      payload.codigo_barras = String(payload.codigo_barras || "").trim() || null;

      ["stock", "precioCompra", "precioVenta", "precio_oferta"].forEach((k) => {
        if (payload[k] != null && payload[k] !== "") {
          payload[k] = Number(payload[k]);
          if (!Number.isFinite(payload[k]) || payload[k] < 0) payload[k] = 0;
        } else {
          payload[k] = payload[k] == null ? null : 0;
        }
      });

      // Guardado de imagen si vino en base64
      if (payload.imagen_base64) {
        const b64 = String(payload.imagen_base64).replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(b64, "base64");
        const filename = `producto_${Date.now()}.png`;
        const imageDir = path.join(app.getPath("userData"), "images", "productos");
        await fs.mkdir(imageDir, { recursive: true });
        const imagePath = path.join(imageDir, filename);
        await fs.writeFile(imagePath, imageBuffer);
        payload.imagen_url = path.join("images", "productos", filename);
      }
      delete payload.imagen_base64;

      // Crear/actualizar
      if (payload.id) {
        await models.Producto.update(payload, { where: { id: payload.id }, transaction: t });
      } else {
        await models.Producto.create(payload, { transaction: t });
      }

      await t.commit();
      return { success: true };
    } catch (error) {
      await t.rollback();
      if (error.name === "SequelizeUniqueConstraintError") {
        const campo = Object.keys(error.fields || {})[0];
        if (campo === "nombre") {
          return { success: false, message: "Ya existe un producto con ese nombre." };
        }
        if (campo === "codigo_barras") {
          return { success: false, message: "El código de barras ya está en uso." };
        }
      }
      console.error("Error al guardar producto:", error);
      return { success: false, message: "Ocurrió un error inesperado al guardar." };
    }
  });

  // Eliminar (manejo de FK)
  ipcMain.handle("eliminar-producto", async (_event, productoId) => {
    try {
      const res = await Producto.destroy({ where: { id: productoId } });
      return res > 0
        ? { success: true }
        : { success: false, message: "Producto no encontrado." };
    } catch (error) {
      if (error.name === "SequelizeForeignKeyConstraintError") {
        return { success: false, message: "No se puede eliminar: tiene ventas/compras asociadas." };
      }
      return { success: false, message: error.message };
    }
  });

  // Activar/Desactivar
  ipcMain.handle("toggle-producto-activo", async (_event, productoId) => {
    try {
      const producto = await Producto.findByPk(productoId);
      if (producto) {
        producto.activo = !producto.activo;
        await producto.save();
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Departamento
  ipcMain.handle("guardar-departamento", async (_event, data) => {
    try {
      const nombre = String(data?.nombre || "").trim();
      if (!nombre) return { success: false, message: "El nombre es obligatorio." };

      const [nuevoDepto, created] = await ProductoDepartamento.findOrCreate({
        where: { nombre },
        defaults: { nombre },
      });
      if (!created) return { success: false, message: "El departamento ya existe." };
      return { success: true, data: nuevoDepto.toJSON() };
    } catch (error) {
      console.error("Error en guardar-departamento:", error);
      return { success: false, message: "Error al guardar el departamento." };
    }
  });

  // Familia
  ipcMain.handle("guardar-familia", async (_event, data) => {
    try {
      const nombre = String(data?.nombre || "").trim();
      const DepartamentoId = data?.DepartamentoId;
      if (!nombre || !DepartamentoId) {
        return { success: false, message: "Faltan datos obligatorios." };
      }
      const [nuevaFamilia, created] = await ProductoFamilia.findOrCreate({
        where: { nombre, DepartamentoId },
        defaults: { nombre, DepartamentoId },
      });
      if (!created) {
        return { success: false, message: "La familia ya existe en este departamento." };
      }
      return { success: true, data: nuevaFamilia.toJSON() };
    } catch (error) {
      console.error("Error en guardar-familia:", error);
      return { success: false, message: "Error al guardar la familia." };
    }
  });
}

module.exports = { registerProductosHandlers };
