// src/ipc-handlers/etiquetas.js
const { ipcMain, BrowserWindow } = require("electron");
const { Op } = require("sequelize");

function registerEtiquetasHandlers(models) {
  const { Producto, ProductoDepartamento, ProductoFamilia } = models;

  ipcMain.handle("get-data-for-seleccion", async () => {
    try {
      const productos = await Producto.findAll({
        include: [
          {
            model: ProductoFamilia,
            as: "familia",
            attributes: ["id", "nombre", "DepartamentoId"],
            include: [{ model: ProductoDepartamento, as: "departamento", attributes: ["id", "nombre"] }],
          },
        ],
        order: [["nombre", "ASC"]],
      });

      const departamentos = await ProductoDepartamento.findAll({
        include: [{ model: ProductoFamilia, as: "familias", attributes: ["id", "nombre"] }],
        order: [["nombre", "ASC"]],
      });

      return {
        productos: productos.map((p) => p.toJSON()),
        departamentos: departamentos.map((d) => d.toJSON()),
      };
    } catch (error) {
      console.error("Error crítico al obtener datos para selección de etiquetas:", error);
      return { productos: [], departamentos: [] };
    }
  });

  // Handler para generar la vista previa de impresión
  ipcMain.handle("generar-vista-impresion", async (_event, payload) => {
    try {
      const { productoIds, config } = payload || {};
      if (!Array.isArray(productoIds) || productoIds.length === 0) {
        console.warn("[etiquetas] productoIds vacío o inválido:", productoIds);
        return { success: false, message: "No se seleccionaron productos." };
      }

      // 1) Detectar nombre y tipo de PK
      const pk =
        Producto?.primaryKeyAttribute ||
        Object.keys(Producto?.primaryKeys || {})[0] ||
        "id";

      const pkAttr = Producto?.rawAttributes?.[pk];
      const typeKey =
        pkAttr?.type?.key ||
        (typeof pkAttr?.type?.toString === "function" ? pkAttr.type.toString() : "");
      const isNumericPK = /INT|DEC|NUM|FLOAT|DOUBLE|BIGINT/i.test(String(typeKey));

      // 2) Normalizar IDs segun tipo de PK
      const idsRaw = [...new Set(
        productoIds
          .map(v => (v == null ? "" : String(v).trim()))
          .filter(v => v !== "")
      )];

      const idsForQuery = isNumericPK
        ? idsRaw.map(Number).filter(Number.isFinite)
        : idsRaw;

      if (idsForQuery.length === 0) {
        return { success: false, message: "IDs de productos inválidos." };
      }

      console.info(`[etiquetas] PK=${pk} (${isNumericPK ? "numérico" : "texto"}), IDs=${idsForQuery.length}`);

      // 3) Buscar productos
      let productos = await Producto.findAll({
        where: { [pk]: { [Op.in]: idsForQuery } },
      });

      // Intento de rescate: si PK es numérico y no encontró nada, probamos string (por castear raro en algunos dialectos)
      if (productos.length === 0 && isNumericPK) {
        const idsAsString = idsRaw; // los originales como string
        productos = await Producto.findAll({
          where: { [pk]: { [Op.in]: idsAsString } },
        });
      }

      console.info(`[etiquetas] ids enviados=${idsRaw.length}, encontrados=${productos.length}`);

      if (!productos || productos.length === 0) {
        return { success: false, message: "No se encontraron productos con esos IDs." };
      }

      // Helpers
      const getPrecioVenta = (p) => {
        const val = p.precioVenta ?? p.precio_venta ?? p.dataValues?.precioVenta ?? p.dataValues?.precio_venta;
        const n = typeof val === "number" ? val : Number(val);
        return Number.isFinite(n) ? n : 0;
        };
      const getCodigo = (p) =>
        p.codigo_barras ?? p.codigoBarras ?? p.dataValues?.codigo_barras ?? p.dataValues?.codigoBarras ?? "";

      let contentHtml = "";

      if (config?.modo === "etiquetas") {
        const items = productos.map((p) => {
          const precio = getPrecioVenta(p);
          const entero = Math.trunc(precio);
          const decimal = Math.round((precio - entero) * 100).toString().padStart(2, "0");
          const logoHtml =
            config.logoSize > 0 && config.logoBase64
              ? `<img src="${config.logoBase64}" style="height: ${config.logoSize}%; max-width: 100%; object-fit: contain;">`
              : "";
          return `
            <div class="label-item" style="width: ${config.ancho}cm; height: ${config.alto}cm; background-color: ${config.colorFondo}; border: 2px solid ${config.colorBorde};">
              <div class="label-nombre">${p.nombre ?? ""}</div>
              <div class="label-precio"><span class="simbolo">$</span><span class="entero">${entero}</span><span class="decimal">${decimal}</span></div>
              <div class="label-codigo">${getCodigo(p)}</div>
              <div class="label-logo">${logoHtml}</div>
            </div>`;
        });
        contentHtml = `<div class="label-grid">${items.join("")}</div>`;
      } else if (config?.modo === "lista") {
        const fechaHoy = new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });
        const baseHeaders = ["Nombre", "P. Venta"];
        const optionalHeaders = (config.columnas || []).map((col) =>
          String(col).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        );
        const headersHtml = [...baseHeaders, ...optionalHeaders].map((h) => `<th>${h}</th>`).join("");

        const rowsHtml = productos.map((p) => {
          const precio = getPrecioVenta(p);
          const baseCells = [
            `<td>${p.nombre ?? ""}</td>`,
            `<td class="precio">$${precio.toFixed(2)}</td>`,
          ];
          const optionalCells = (config.columnas || []).map((col) => {
            let val = "";
            switch (col) {
              case "codigo_barras":
                val = getCodigo(p);
                break;
              case "precioCompra":
              case "precio_compra": {
                const raw = p.precioCompra ?? p.precio_compra ?? p.dataValues?.precioCompra ?? p.dataValues?.precio_compra;
                const n = typeof raw === "number" ? raw : Number(raw) || 0;
                val = `$${n.toFixed(2)}`;
                break;
              }
              default:
                val = p[col] ?? p.dataValues?.[col] ?? "";
            }
            return `<td>${val ?? ""}</td>`;
          });

          return `<tr>${[...baseCells, ...optionalCells].join("")}</tr>`;
        }).join("");

        contentHtml = `
          <div class="list-container">
            <h1>${config.listaTitulo || "Lista de Precios"}</h1>
            <p>Fecha de Emisión: ${fechaHoy}</p>
            <table>
              <thead><tr>${headersHtml}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>`;
      } else {
        return { success: false, message: "Modo inválido (debe ser 'etiquetas' o 'lista')." };
      }

      const printCss = `
        body { margin:0; font-family:sans-serif; }
        .no-print { position:fixed; top:10px; left:10px; background:#eee; padding:10px; border-radius:5px; box-shadow:0 2px 5px rgba(0,0,0,.3); }
        @media print { .no-print { display:none; } }

        .label-grid { display:flex; flex-wrap:wrap; padding:.5cm; gap:0; }
        .label-item { display:flex; flex-direction:column; justify-content:space-between; align-items:center; text-align:center; padding:.2cm; box-sizing:border-box; overflow:hidden; page-break-inside:avoid; }
        .label-nombre { font-size:14px; font-weight:bold; }
        .label-precio { font-weight:bold; line-height:1; }
        .label-precio .simbolo { font-size:18px; vertical-align:top; }
        .label-precio .entero { font-size:36px; }
        .label-precio .decimal { font-size:16px; vertical-align:top; }
        .label-codigo { font-size:10px; }
        .label-logo { height:30%; display:flex; align-items:center; justify-content:center; }

        .list-container { padding: 2cm; }
        h1 { font-size:24px; margin:0 0 8px; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th, td { border:1px solid #ccc; padding:8px; text-align:left; }
        th { background-color:#f2f2f2; }
        td.precio { font-weight:bold; }
      `;

      const finalHtml = `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8" /><title>Vista Previa de Impresión</title><style>${printCss}</style></head>
          <body>
            <div class="no-print"><button onclick="window.print()">🖨️ Imprimir</button></div>
            ${contentHtml}
          </body>
        </html>`;

      const printWindow = new BrowserWindow({
        width: 900,
        height: 700,
        show: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      printWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(finalHtml));
      return { success: true };
    } catch (error) {
      console.error("Error al generar vista de impresión:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerEtiquetasHandlers };
