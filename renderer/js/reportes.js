// renderer/js/reportes.js
document.addEventListener("app-ready", () => {
  // --- REFS ---
  const filtroFecha = document.getElementById("filtro-fecha");
  const busquedaInput = document.getElementById("busqueda-producto");
  const btnAplicarFiltros = document.getElementById("btn-aplicar-filtros");
  const tablaBody = document.querySelector("#ventas-table tbody");
  const totalVentasDisplay = document.getElementById("total-ventas");
  const cantidadVentasDisplay = document.getElementById("cantidad-ventas");

  // --- UTILS ---
  const money = (n) =>
    (n || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const dt = (d) =>
    d
      ? new Date(d).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " hs"
      : "N/A";

  const setLoading = () => {
    tablaBody.innerHTML =
      '<tr><td colspan="11" class="text-center">Cargando ventas...</td></tr>';
  };

  // --- DATA ---
  const cargarVentas = async () => {
    setLoading();
    const filtros = {
      fecha: filtroFecha.value,
      busqueda: (busquedaInput.value || "").trim(),
    };

    try {
      const ventas = await window.electronAPI.invoke("get-ventas", filtros);
      if (!Array.isArray(ventas)) {
        console.error("Formato inesperado:", ventas);
        tablaBody.innerHTML =
          '<tr><td colspan="11" class="error-cell">Error: formato de datos incorrecto.</td></tr>';
        actualizarResumen([]);
        return;
      }
      renderTabla(ventas);
      actualizarResumen(ventas);
    } catch (e) {
      console.error("get-ventas", e);
      tablaBody.innerHTML =
        '<tr><td colspan="11" class="error-cell">Hubo un error al cargar las ventas.</td></tr>';
      actualizarResumen([]);
    }
  };

  const renderTabla = (ventas) => {
    tablaBody.innerHTML = "";
    if (ventas.length === 0) {
      tablaBody.innerHTML =
        '<tr><td colspan="11" class="empty-cell">No se encontraron ventas con estos filtros.</td></tr>';
      return;
    }

    ventas.forEach((v) => {
      const row = document.createElement("tr");
      const nombreCliente = v.Cliente?.nombre
        ? `${v.Cliente.nombre} ${v.Cliente.apellido || ""}`
        : v.dniCliente || "Consumidor Final";

      // Normalizar detalles a array seguro
      let detalles = [];
      if (v.detalles) detalles = Array.isArray(v.detalles) ? v.detalles : [v.detalles];

      const detallesHtml =
        detalles.length > 0
          ? `<table class="tabla-anidada">
              <thead>
                <tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                ${detalles
                  .map(
                    (d) => `
                    <tr>
                      <td>${d.nombreProducto || "N/A"}</td>
                      <td>${d.cantidad}</td>
                      <td>${money(d.precioUnitario)}</td>
                      <td>${money(d.subtotal)}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
          : "<span>Sin detalles</span>";

      const subtotal = detalles.reduce((acc, it) => acc + (it.subtotal || 0), 0);

      row.innerHTML = `
        <td>${v.id}</td>
        <td>${dt(v.createdAt)}</td>
        <td>${nombreCliente}</td>
        <td>${v.metodoPago}</td>
        <td>${money(subtotal)}</td>
        <td class="valor-negativo">${money(-v.montoDescuento)}</td>
        <td class="valor-positivo">${money(v.recargo)}</td>
        <td class="col-total">${money(v.total)}</td>
        <td>${v.metodoPago === "Efectivo" ? money(v.montoPagado) : "N/A"}</td>
        <td>${v.metodoPago === "Efectivo" ? money(v.vuelto) : "N/A"}</td>
        <td class="col-detalles">${detallesHtml}</td>
      `;
      tablaBody.appendChild(row);
    });
  };

  const actualizarResumen = (ventas) => {
    const total = ventas.reduce((acc, v) => acc + (v.total || 0), 0);
    totalVentasDisplay.textContent = money(total);
    cantidadVentasDisplay.textContent = ventas.length;
  };

  // --- EVENTS ---
  btnAplicarFiltros.addEventListener("click", cargarVentas);
  busquedaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") cargarVentas();
  });
  filtroFecha.addEventListener("change", cargarVentas);

  // --- INIT ---
  cargarVentas();
});
