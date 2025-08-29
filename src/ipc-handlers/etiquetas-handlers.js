// src/ipc-handlers/etiquetas.js
const { ipcMain, BrowserWindow } = require("electron");

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

     // Handler para generar la vista previa de impresión (SIN CAMBIOS EN SU LÓGICA INTERNA)
    ipcMain.handle('generar-vista-impresion', async (event, { productoIds, config }) => {
        try {
            const productos = await Producto.findAll({ where: { id: productoIds } });
            let contentHtml = '';

            if (config.modo === 'etiquetas') {
                contentHtml = productos.map(p => {
                    const precioEntero = Math.trunc(p.precioVenta);
                    const precioDecimal = Math.round((p.precioVenta - precioEntero) * 100).toString().padEnd(2, '0');
                    const logoHtml = config.logoSize > 0 && config.logoBase64 ?
                        `<img src="${config.logoBase64}" style="height: ${config.logoSize}%; max-width: 100%; object-fit: contain;">` : '';
                    return `
                        <div class="label-item" style="width: ${config.ancho}cm; height: ${config.alto}cm; background-color: ${config.colorFondo}; border: 2px solid ${config.colorBorde};">
                            <div class="label-nombre">${p.nombre}</div>
                            <div class="label-precio"><span class="simbolo">$</span><span class="entero">${precioEntero}</span><span class="decimal">${precioDecimal}</span></div>
                            <div class="label-codigo">${p.codigo_barras || ''}</div>
                            <div class="label-logo">${logoHtml}</div>
                        </div>`;
                }).join('');
                contentHtml = `<div class="label-grid">${contentHtml}</div>`;

            } else if (config.modo === 'lista') {
                const fechaHoy = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
                const baseHeaders = ['Nombre', 'P. Venta'];
                const optionalHeaders = config.columnas.map(col => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                const headersHtml = [...baseHeaders, ...optionalHeaders].map(h => `<th>${h}</th>`).join('');
                const rowsHtml = productos.map(p => {
                    const baseCells = [`<td>${p.nombre}</td>`, `<td class="precio">$${p.precioVenta.toFixed(2)}</td>`];
                    const optionalCells = config.columnas.map(col => {
                        let cellValue = p[col];
                        if (col === 'precioCompra' && typeof cellValue === 'number') cellValue = `$${cellValue.toFixed(2)}`;
                        return `<td>${cellValue || ''}</td>`;
                    });
                    return `<tr>${[...baseCells, ...optionalCells].join('')}</tr>`;
                }).join('');
                
                contentHtml = `
                    <div class="list-container">
                        <h1>${config.listaTitulo}</h1><p>Fecha de Emisión: ${fechaHoy}</p>
                        <table><thead><tr>${headersHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
                    </div>`;
            }

            const printCss = `
                body { margin: 0; font-family: sans-serif; }
                .no-print { position: fixed; top: 10px; left: 10px; background: #eee; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
                @media print { .no-print { display: none; } }
                .label-grid { display: flex; flex-wrap: wrap; padding: 0.5cm; gap: 0; }
                .label-item { display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 0.2cm; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; }
                .label-nombre { font-size: 14px; font-weight: bold; }
                .label-precio { font-weight: bold; line-height: 1; }
                .label-precio .simbolo { font-size: 18px; vertical-align: top; }
                .label-precio .entero { font-size: 36px; }
                .label-precio .decimal { font-size: 16px; vertical-align: top; }
                .label-codigo { font-size: 10px; }
                .label-logo { height: 30%; display:flex; align-items:center; justify-content:center; }
                .list-container { padding: 2cm; } h1 { font-size: 24px; } table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } td.precio { font-weight: bold; }`;

            const finalHtml = `
                <!DOCTYPE html><html><head><title>Vista Previa de Impresión</title><style>${printCss}</style></head>
                <body><div class="no-print"><button onclick="window.print()">🖨️ Imprimir</button></div>${contentHtml}</body></html>`;

            const printWindow = new BrowserWindow({ width: 800, height: 600, show: true, webPreferences: { nodeIntegration: false, contextIsolation: true } });
            printWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(finalHtml));
            
            return { success: true };
        } catch (error) {
            console.error("Error al generar vista de impresión:", error);
            return { success: false, message: error.message };
        }
    });
}

module.exports = { registerEtiquetasHandlers };
