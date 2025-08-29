// renderer/js/dashboard.js (versión robusta)
document.addEventListener("app-ready", () => {
  // --- REFS ---
  const filterButtons = document.querySelectorAll(".btn-filter");
  const deptoFilter = document.getElementById("depto-filter");
  const familiaFilter = document.getElementById("familia-filter");
  const dateFromInput = document.getElementById("date-from");
  const dateToInput = document.getElementById("date-to");
  const btnApplyCustom = document.getElementById("btn-apply-custom");

  const totalFacturadoCard = document.getElementById("total-facturado");
  const gananciaBrutaCard = document.getElementById("ganancia-bruta");
  const totalComprasCard = document.getElementById("total-compras");
  const totalGastosCard = document.getElementById("total-gastos");
  const numeroVentasCard = document.getElementById("numero-ventas");
  const ticketPromedioCard = document.getElementById("ticket-promedio");

  const ventasChartCtx = document.getElementById("ventas-chart")?.getContext("2d");
  const topProductosList = document.getElementById("top-productos-list");
  const healthScoreDisplay = document.getElementById("health-score");
  const healthFill = document.getElementById("gauge-fill");
  const healthMarginDisplay = document.getElementById("health-margin");
  const healthGrowthDisplay = document.getElementById("health-growth");

  const cierresCajaBody = document.getElementById("cierres-caja-tbody"); // opcional (si lo tuvieses)

  // --- STATE ---
  let ventasChartInstance = null;
  let familiasData = [];

  const money = (v) => (v || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

  // --- RENDER ---
  const renderTarjetas = (stats) => {
    totalFacturadoCard.textContent = money(stats.totalFacturado);
    gananciaBrutaCard.textContent = money(stats.gananciaBruta);
    totalComprasCard.textContent = money(stats.totalComprasproducto);
    totalGastosCard.textContent = money(stats.totalGastosFijos);
    numeroVentasCard.textContent = stats.numeroVentas || 0;
    ticketPromedioCard.textContent = money(stats.ticketPromedio);

    const margen = stats.margenGanancia || 0;
    const crecimiento =
      stats.totalFacturadoAnterior > 0
        ? ((stats.totalFacturado / stats.totalFacturadoAnterior - 1) * 100)
        : 0;
    const salud = Math.max(0, Math.min(100, margen * 0.6 + crecimiento * 0.4));

    healthMarginDisplay.textContent = `${margen.toFixed(1)}%`;
    healthGrowthDisplay.textContent = `${crecimiento.toFixed(1)}%`;
    healthScoreDisplay.textContent = `${salud.toFixed(0)}%`;
    if (healthFill) healthFill.style.transform = `rotate(${salud * 1.8}deg)`;
  };

  const renderGraficoVentas = (ventasPorDia) => {
    if (!ventasChartCtx) return;
    if (ventasChartInstance) ventasChartInstance.destroy();

    const labels = ventasPorDia.map((v) =>
      new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
    );
    const data = ventasPorDia.map((v) => v.total_diario);

    ventasChartInstance = new Chart(ventasChartCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Ventas por Día",
            data,
            borderColor: "rgba(75,192,192,1)",
            backgroundColor: "rgba(75,192,192,0.2)",
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  };

  const renderTopProductos = (productos) => {
    if (!topProductosList) return;
    if (!productos || productos.length === 0) {
      topProductosList.innerHTML = "<li>No hay datos de productos para este período.</li>";
      return;
    }
    topProductosList.innerHTML = productos
      .map(
        (p) => `
      <li>
        <span class="product-name">${p["producto.nombre"]}</span>
        <span class="product-sales">${p.total_vendido} vendidos</span>
      </li>`
      )
      .join("");
  };

  const renderCierresCaja = (cierres) => {
    if (!cierresCajaBody) return;
    if (!cierres || cierres.length === 0) {
      cierresCajaBody.innerHTML = "<tr><td colspan='4'>No hay cierres de caja registrados.</td></tr>";
      return;
    }
    const moneyFmt = (v) => (v || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
    cierresCajaBody.innerHTML = cierres
      .map(
        (c) => `
      <tr>
        <td>${new Date(c.fechaCierre).toLocaleString("es-AR")}</td>
        <td>${c.usuario?.nombre || "N/A"}</td>
        <td class="${c.diferencia < 0 ? "valor-negativo" : "valor-positivo"}">${moneyFmt(c.diferencia)}</td>
        <td><button class="btn btn-info btn-sm" onclick="alert('Imprimir cierre ${c.id}')">Imprimir</button></td>
      </tr>`
      )
      .join("");
  };

  // --- DATA ---
  const setLoading = () => {
    totalFacturadoCard.textContent = "Cargando...";
    gananciaBrutaCard.textContent = "Cargando...";
    totalComprasCard.textContent = "Cargando...";
    totalGastosCard.textContent = "Cargando...";
    numeroVentasCard.textContent = "...";
    ticketPromedioCard.textContent = "...";
  };

  const getDateRange = () => {
    const active = document.querySelector(".btn-filter.active");
    const range = active ? active.dataset.range : "today";
    const today = new Date();
    let from = new Date(today), to = new Date(today);

    switch (range) {
      case "week":
        from.setDate(today.getDate() - today.getDay());
        break;
      case "month":
        from.setDate(1);
        break;
      case "custom":
        from = new Date(dateFromInput.value);
        to = new Date(dateToInput.value);
        break;
      case "today":
      default:
        break;
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return [from, to];
  };

  const cargarStats = async () => {
    setLoading();
    const [dateFrom, dateTo] = getDateRange();
    const departamentoId = deptoFilter.value || null;
    const familiaId = familiaFilter.value || null;

    try {
      const result = await window.electronAPI.invoke("get-dashboard-stats", {
        dateFrom,
        dateTo,
        departamentoId,
        familiaId,
      });
      if (!result?.success) throw new Error(result?.message || "Fallo desconocido");
      renderTarjetas(result.stats);
      renderGraficoVentas(result.stats.ventasPorDia || []);
      renderTopProductos(result.stats.productosMasVendidos || []);
    } catch (e) {
      console.error("dashboard stats", e);
      // Mantén algún mensaje si querés en UI
    }
  };

  const cargarCierres = async () => {
    if (!cierresCajaBody) return;
    try {
      const cierres = await window.electronAPI.invoke("get-all-cierres-caja");
      renderCierresCaja(cierres);
    } catch (e) {
      console.error("cierres-caja", e);
      cierresCajaBody.innerHTML =
        "<tr><td colspan='4' style='color:red;'>Error al cargar datos.</td></tr>";
    }
  };

  // --- LISTENERS ---
  filterButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(".custom-range").style.display = "none";
      cargarStats();
    })
  );

  dateFromInput.addEventListener("change", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    document.querySelector(".custom-range").style.display = "flex";
  });
  dateToInput.addEventListener("change", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    document.querySelector(".custom-range").style.display = "flex";
  });

  btnApplyCustom.addEventListener("click", () => {
    const customRangeDiv = document.querySelector(".custom-range");
    const newButton = document.createElement("button");
    newButton.className = "btn btn-filter active";
    newButton.dataset.range = "custom";
    newButton.textContent = `${new Date(dateFromInput.value).toLocaleDateString()} - ${new Date(
      dateToInput.value
    ).toLocaleDateString()}`;

    document.querySelectorAll('button[data-range="custom"]').forEach((b) => b.remove());
    customRangeDiv.insertAdjacentElement("beforebegin", newButton);

    newButton.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      newButton.classList.add("active");
      customRangeDiv.style.display = "flex";
      cargarStats();
    });

    cargarStats();
  });

  deptoFilter.addEventListener("change", () => {
    const deptoId = deptoFilter.value ? parseInt(deptoFilter.value, 10) : null;
    familiaFilter.innerHTML = '<option value="">Todas las Familias</option>';
    if (deptoId) {
      const filtradas = familiasData.filter((f) => f.DepartamentoId === deptoId);
      filtradas.forEach((f) => (familiaFilter.innerHTML += `<option value="${f.id}">${f.nombre}</option>`));
      familiaFilter.disabled = false;
    } else {
      familiaFilter.disabled = true;
    }
    cargarStats();
  });
  familiaFilter.addEventListener("change", cargarStats);

  // --- INIT ---
  (async () => {
    try {
      const deptos = await window.electronAPI.invoke("get-departamentos");
      familiasData = await window.electronAPI.invoke("get-familias");
      deptoFilter.innerHTML = '<option value="">Todos los Departamentos</option>';
      deptos.forEach((d) => (deptoFilter.innerHTML += `<option value="${d.id}">${d.nombre}</option>`));
    } catch (e) {
      console.error("cargar filtros", e);
    }

    await cargarStats();
    await cargarCierres();
  })();
});
