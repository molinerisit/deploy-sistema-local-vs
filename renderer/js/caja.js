// renderer/js/caja.js
document.addEventListener("app-ready", () => {
  // --- 1. ESTADO & REFS ---
  const CajaState = {
    ventaActual: [],
    clienteActual: null,
    metodoPagoSeleccionado: null,
    ultimoReciboTexto: null,
    sesion: null,
    arqueoActual: null,
    barcodeBuffer: [],
    barcodeTimer: null,
    isRendering: false,
    ultimoMPPaymentId: null,
    ultimaExternalReference: null,
  };

  // DOM
  const mainInput = document.getElementById("main-input");
  const tablaBody = document.getElementById("tabla-productos");
  const totalDisplay = document.getElementById("total-display");
  const itemsCountDisplay = document.getElementById("items-count-display");
  const subtotalDisplay = document.getElementById("subtotal-display");
  const descuentoDisplay = document.getElementById("descuento-display");
  const descuentoFila = document.querySelector(".descuento-fila");
  const descuentoEfectivoDisplay = document.getElementById(
    "descuento-efectivo-display"
  );
  const descuentoEfectivoFila = document.querySelector(
    ".descuento-efectivo-fila"
  );
  const recargoDisplay = document.getElementById("recargo-display");
  const recargoFila = document.querySelector(".recargo-fila");
  const dniInput = document.getElementById("dni-cliente");
  const btnBuscarCliente = document.getElementById("btn-buscar-cliente");
  const clienteInfo = document.getElementById("cliente-info");
  const paymentButtons = document.querySelectorAll(".payment-methods button");
  const efectivoArea = document.getElementById("efectivo-area");
  const montoPagadoInput = document.getElementById("monto-pagado");
  const vueltoDisplay = document.getElementById("vuelto-display");
  const btnRegistrarVenta = document.getElementById("registrar-venta-btn");
  const btnCancelarVenta = document.getElementById("cancelar-venta-btn");
  const btnImprimirTicket = document.getElementById("imprimir-ticket-btn");
  const generarFacturaCheckbox = document.getElementById(
    "generar-factura-check"
  );

  // Modales/Toast
  const modalContainer = document.getElementById("modal-container");
  const modalMessage = document.getElementById("modal-message");
  const modalAcceptBtn = document.getElementById("modal-accept-btn");
  const toastNotification = document.getElementById("toast-notification");
  const bloqueoSuperposicion = document.getElementById(
    "bloqueo-panel-superposicion"
  );

  // Modal Venta Exitosa
  const ventaExitosaModal = document.getElementById("venta-exitosa-modal");
  const exTotal = document.getElementById("ex-total");
  const exMetodoPago = document.getElementById("ex-metodo-pago");
  const resumenPagoMP = document.getElementById("resumen-pago-mp");
  const exMpId = document.getElementById("ex-mp-id");
  const exBtnImprimirMP = document.getElementById("ex-btn-imprimir-mp");
  const exBtnCerrar = document.getElementById("ex-btn-cerrar");

  // Arqueo
  const abrirCajaBtn = document.getElementById("abrir-caja-btn");
  const cerrarCajaBtn = document.getElementById("cerrar-caja-btn");
  const aperturaCajaModal = document.getElementById("apertura-caja-modal");
  const aperturaCajaForm = document.getElementById("apertura-caja-form");
  const montoInicialInput = document.getElementById("monto-inicial");
  const cancelarAperturaBtn = document.getElementById("cancelar-apertura-btn");
  const cierreCajaModal = document.getElementById("cierre-caja-modal");
  const resumenCierreCaja = document.getElementById("resumen-cierre-caja");
  const cierreCajaForm = document.getElementById("cierre-caja-form");
  const montoFinalRealInput = document.getElementById("monto-final-real");
  const observacionesCierreInput = document.getElementById(
    "observaciones-cierre"
  );
  const cancelarCierreBtn = document.getElementById("cancelar-cierre-btn");

  // --- 2. UTILIDADES UI ---
  const formatCurrency = (value) =>
    (value || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    });

  const showErrorModal = (message) => {
    if (!modalContainer) return;
    modalMessage.textContent = message;
    modalContainer.classList.remove("oculto");
    modalAcceptBtn.focus();
  };

  const hideErrorModal = () => {
    if (!modalContainer) return;
    modalContainer.classList.add("oculto");
    mainInput?.focus();
  };

  const showToast = (message, type = "success") => {
    if (!toastNotification) return;
    toastNotification.textContent = message;
    toastNotification.className = `toast ${type} visible`;
    setTimeout(() => toastNotification.classList.remove("visible"), 3000);
  };

  const toggleButtonLoading = (button, isLoading, originalText) => {
    if (!button) return;
    if (!button.dataset.originalText && originalText) {
      button.dataset.originalText = originalText;
    }
    button.disabled = isLoading;
    button.textContent = isLoading
      ? "Procesando..."
      : button.dataset.originalText || originalText;
  };

  const mostrarModalVentaExitosa = (result) => {
    if (!ventaExitosaModal) return;
    exTotal.textContent = formatCurrency(result.datosRecibo.total);
    exMetodoPago.textContent = result.datosRecibo.metodoPago || "-";
    if (result.datosPagoMP) {
      exMpId.textContent = result.datosPagoMP.id;
      resumenPagoMP.classList.remove("oculto");
    } else {
      resumenPagoMP.classList.add("oculto");
    }
    ventaExitosaModal.classList.add("visible");
  };

  const bloquearUI = (mensaje) => {
    if (!bloqueoSuperposicion) return;
    bloqueoSuperposicion.querySelector("p").textContent = mensaje;
    bloqueoSuperposicion.classList.remove("oculto");
    mainInput && (mainInput.disabled = true);
    document
      .querySelectorAll(
        ".acciones-panel button, .venta-panel input, .venta-panel button"
      )
      .forEach((el) => {
        if (!el.closest(".arqueo-actions")) el.disabled = true;
      });
  };

  const desbloquearUI = () => {
    if (!bloqueoSuperposicion) return;
    bloqueoSuperposicion.classList.add("oculto");
    mainInput && (mainInput.disabled = false);
    document
      .querySelectorAll(
        ".acciones-panel button, .venta-panel input, .venta-panel button"
      )
      .forEach((el) => (el.disabled = false));
    mainInput?.focus();
  };

  const getCfg = () => ({
    dtoEf: Number(CajaState.sesion?.config?.config_descuento_efectivo) || 0,
    recCredito: Number(CajaState.sesion?.config?.config_recargo_credito) || 0,
    arqueo: CajaState.sesion?.config?.config_arqueo_caja || {
      habilitado: false,
    },
    nombreNegocio: CajaState.sesion?.config?.nombre_negocio || "Mi Negocio",
    sloganNegocio: CajaState.sesion?.config?.slogan_negocio || "",
    footerTicket:
      CajaState.sesion?.config?.footer_ticket || "¡Gracias por su compra!",
    impresora: CajaState.sesion?.config?.config_puerto_impresora || null,
  });

  const actualizarEstadoVisualCaja = () => {
    const cfg = getCfg();
    if (!cfg.arqueo.habilitado) {
      abrirCajaBtn?.classList.add("oculto");
      cerrarCajaBtn?.classList.add("oculto");
      desbloquearUI();
      return;
    }
    if (CajaState.arqueoActual) {
      abrirCajaBtn?.classList.add("oculto");
      cerrarCajaBtn?.classList.remove("oculto");
      desbloquearUI();
    } else {
      abrirCajaBtn?.classList.remove("oculto");
      cerrarCajaBtn?.classList.add("oculto");
      bloquearUI("Debes realizar la apertura de caja para comenzar a vender.");
    }
  };

  const actualizarCalculoVuelto = () => {
    if (CajaState.metodoPagoSeleccionado !== "Efectivo") {
      vueltoDisplay && (vueltoDisplay.textContent = formatCurrency(0));
      return;
    }
    const totalString = totalDisplay?.textContent || "$0";
    const clean = totalString.replace(/[^\d,]/g, "").replace(",", ".");
    const total = parseFloat(clean) || 0;
    const pagado = parseFloat(montoPagadoInput?.value) || 0;
    const vuelto = pagado > total ? pagado - total : 0;
    vueltoDisplay && (vueltoDisplay.textContent = formatCurrency(vuelto));
  };

  // --- 3. RENDER & NEGOCIO ---
  const renderizarVenta = () => {
    if (CajaState.isRendering) return;
    CajaState.isRendering = true;

    requestAnimationFrame(() => {
      if (!tablaBody) {
        CajaState.isRendering = false;
        return;
      }
      tablaBody.innerHTML = "";

      const totalItems = CajaState.ventaActual.reduce(
        (acc, i) => acc + i.cantidad,
        0
      );
      itemsCountDisplay && (itemsCountDisplay.textContent = totalItems);

      let subtotal = 0;
      CajaState.ventaActual.forEach((item, index) => {
        const itemSubtotal = item.precioUnitario * item.cantidad;
        subtotal += itemSubtotal;

        const row = document.createElement("tr");
        const imagenSrc = item.producto?.imagen_url
          ? `app://${item.producto.imagen_url.replace(/\\/g, "/")}`
          : "app://images/logo.png";
        row.innerHTML = `
          <td><img src="${imagenSrc}" alt="${
          item.nombreProducto
        }" width="40" height="40"
              style="object-fit:cover;border-radius:4px;" onerror="this.style.display='none';"></td>
          <td>${item.nombreProducto}</td>
          <td><input type="number" class="cantidad-input" value="${
            item.cantidad
          }" data-index="${index}"
              min="0.01" step="any" style="width:70px;"></td>
          <td>${formatCurrency(item.precioUnitario)}</td>
          <td>${formatCurrency(itemSubtotal)}</td>
          <td><button data-index="${index}" class="btn-delete-item" title="Quitar">X</button></td>
        `;
        tablaBody.appendChild(row);
      });

      const cfg = getCfg();

      // Descuentos y recargos
      let dCliente = 0;
      if ((CajaState.clienteActual?.descuento || 0) > 0) {
        dCliente = subtotal * (CajaState.clienteActual.descuento / 100);
        descuentoFila?.classList.remove("oculto");
      } else {
        descuentoFila?.classList.add("oculto");
      }

      let dEfectivo = 0;
      if (CajaState.metodoPagoSeleccionado === "Efectivo" && cfg.dtoEf > 0) {
        dEfectivo = (subtotal - dCliente) * (cfg.dtoEf / 100);
        descuentoEfectivoFila?.classList.remove("oculto");
      } else {
        descuentoEfectivoFila?.classList.add("oculto");
      }

      const descuentos = dCliente + dEfectivo;

      let recargo = 0;
      if (
        CajaState.metodoPagoSeleccionado === "Crédito" &&
        cfg.recCredito > 0
      ) {
        recargo = (subtotal - descuentos) * (cfg.recCredito / 100);
        recargoFila?.classList.remove("oculto");
      } else {
        recargoFila?.classList.add("oculto");
      }

      const total = subtotal - descuentos + recargo;

      subtotalDisplay &&
        (subtotalDisplay.textContent = formatCurrency(subtotal));
      descuentoDisplay &&
        (descuentoDisplay.textContent = `-${formatCurrency(dCliente)}`);
      descuentoEfectivoDisplay &&
        (descuentoEfectivoDisplay.textContent = `-${formatCurrency(
          dEfectivo
        )}`);
      recargoDisplay &&
        (recargoDisplay.textContent = `+${formatCurrency(recargo)}`);
      totalDisplay && (totalDisplay.textContent = formatCurrency(total));

      actualizarCalculoVuelto();
      CajaState.isRendering = false;
    });
  };

  const limpiarEstadoParaNuevaVentaSiCorresponde = () => {
    if (CajaState.ventaActual.length === 0) {
      CajaState.ultimoReciboTexto = null;
      CajaState.ultimoMPPaymentId = null;
      btnImprimirTicket && (btnImprimirTicket.disabled = true);
    }
  };

  const agregarProductoALaVenta = (
    producto,
    cantidad = 1,
    precioOverride = null
  ) => {
    limpiarEstadoParaNuevaVentaSiCorresponde();

    if (!producto || (producto.id && producto.activo === false)) {
      showErrorModal(
        `El producto "${producto?.nombre || "-"}" no está activo o no existe.`
      );
      return;
    }

    const itemExistente = CajaState.ventaActual.find(
      (i) =>
        i.producto && i.producto.id === producto.id && precioOverride === null
    );

    if (itemExistente) {
      itemExistente.cantidad += cantidad;
    } else {
      CajaState.ventaActual.push({
        producto,
        nombreProducto: producto.nombre,
        precioUnitario:
          precioOverride !== null ? precioOverride : producto.precioVenta,
        cantidad,
      });
    }
    renderizarVenta();
  };

  const agregarIngresoManual = (monto) => {
    limpiarEstadoParaNuevaVentaSiCorresponde();
    CajaState.ventaActual.push({
      producto: null,
      nombreProducto: "Ingreso Manual",
      precioUnitario: monto,
      cantidad: 1,
    });
    renderizarVenta();
  };

  const procesarEntrada = async (valor) => {
    if (!valor) return;
    try {
      const encontrado = await window.electronAPI.invoke(
        "busqueda-inteligente",
        valor
      );
      if (encontrado) {
        agregarProductoALaVenta(
          encontrado,
          encontrado.cantidad || 1,
          encontrado.precioVenta
        );
      } else {
        const monto = parseFloat(valor);
        if (!isNaN(monto) && monto > 0) agregarIngresoManual(monto);
        else showErrorModal(`Producto no encontrado para: "${valor}"`);
      }
    } catch (e) {
      console.error("procesarEntrada", e);
      showErrorModal("Ocurrió un error al buscar el producto.");
    }
    if (mainInput) mainInput.value = "";
  };

  const generarReciboTexto = (ventaId, datosRecibo) => {
    const cfg = getCfg();
    const cajero = CajaState.sesion?.user?.nombre || "N/A";

    let texto = "";
    if (cfg.nombreNegocio) texto += `${cfg.nombreNegocio}\n`;
    if (cfg.sloganNegocio) texto += `${cfg.sloganNegocio}\n`;

    texto += `--------------------------------\n`;
    texto += `COMPROBANTE NRO: ${String(ventaId).padStart(6, "0")}\n`;
    texto += `FECHA: ${new Date().toLocaleString("es-AR")}\n`;
    texto += `CAJERO: ${cajero}\n`;
    if (datosRecibo.dniCliente)
      texto += `CLIENTE DNI: ${datosRecibo.dniCliente}\n`;
    texto += `--------------------------------\n`;

    let subtotal = 0;
    datosRecibo.items.forEach((it) => {
      const nombre = (it.nombreProducto || "").padEnd(20, " ").substring(0, 20);
      const subItem = it.cantidad * it.precioUnitario;
      subtotal += subItem;
      texto += `${nombre}\n ${it.cantidad} x ${formatCurrency(
        it.precioUnitario
      )} = ${formatCurrency(subItem)}\n`;
    });

    texto += `--------------------------------\n`;
    texto += `SUBTOTAL: ${formatCurrency(subtotal)}\n`;
    if (datosRecibo.descuento > 0)
      texto += `DESCUENTO: -${formatCurrency(datosRecibo.descuento)}\n`;
    if (datosRecibo.recargo > 0)
      texto += `RECARGO: +${formatCurrency(datosRecibo.recargo)}\n`;
    texto += `TOTAL: ${formatCurrency(datosRecibo.total)}\n`;
    texto += `METODO PAGO: ${datosRecibo.metodoPago}\n`;
    if (datosRecibo.metodoPago === "Efectivo") {
      texto += `PAGA CON: ${formatCurrency(datosRecibo.montoPagado)}\n`;
      texto += `VUELTO: ${formatCurrency(datosRecibo.vuelto)}\n`;
    }
    if (cfg.footerTicket) texto += `\n${cfg.footerTicket}\n`;
    texto += `\n.`; // corte

    return texto;
  };

  const resetearVenta = () => {
    CajaState.ventaActual = [];
    CajaState.metodoPagoSeleccionado = null;
    CajaState.clienteActual = null;
    CajaState.ultimaExternalReference = null;
    if (mainInput) mainInput.value = "";
    if (dniInput) dniInput.value = "";
    if (clienteInfo) clienteInfo.textContent = "";
    if (montoPagadoInput) montoPagadoInput.value = "";
    paymentButtons.forEach((btn) => btn.classList.remove("active"));
    efectivoArea?.classList.add("oculto");
    btnRegistrarVenta && (btnRegistrarVenta.disabled = false);
    generarFacturaCheckbox && (generarFacturaCheckbox.checked = false);
    toggleButtonLoading(btnRegistrarVenta, false, "Registrar Venta");
    renderizarVenta();
    mainInput?.focus();
  };

  // --- 4. INICIALIZACIÓN ---
  const inicializarPagina = async () => {
    try {
      if (!window.APP_SESSION) {
        showErrorModal("Error crítico: La sesión no se ha cargado.");
        return bloquearUI("Error de sesión.");
      }
      CajaState.sesion = window.APP_SESSION;

      const cfg = getCfg();
      if (cfg.arqueo.habilitado) {
        const estadoCaja = await window.electronAPI.invoke("get-estado-caja");
        if (estadoCaja.error) throw new Error(estadoCaja.error);
        CajaState.arqueoActual = estadoCaja.cajaAbierta;
      } else {
        CajaState.arqueoActual = true;
      }
      actualizarEstadoVisualCaja();
      resetearVenta();
    } catch (e) {
      console.error("init caja:", e);
      showErrorModal(`Error crítico al iniciar: ${e.message}.`);
      bloquearUI("Error de inicialización.");
    }
  };

  // --- 5. EVENTOS ---
  document.addEventListener("keydown", (event) => {
    // si hay modal de error visible
    if (modalContainer && !modalContainer.classList.contains("oculto")) {
      if (event.key === "Enter") {
        event.preventDefault();
        modalAcceptBtn.click();
      }
      return;
    }
    // si está modal de venta exitosa
    if (ventaExitosaModal && ventaExitosaModal.classList.contains("visible")) {
      if (event.key === "Enter") {
        event.preventDefault();
        exBtnCerrar?.click();
      }
      return;
    }

    // Hotkeys rápidos
    let isHot = true;
    switch (event.key) {
      case ",":
        document.querySelector('button[data-metodo="Efectivo"]')?.click();
        break;
      case ".":
        document.querySelector('button[data-metodo="Débito"]')?.click();
        break;
      case "-":
        document.querySelector('button[data-metodo="Crédito"]')?.click();
        break;
      case "ArrowUp":
        document.querySelector('button[data-metodo="QR"]')?.click();
        break;
      case "ñ":
      case "Ñ":
        if (!btnRegistrarVenta?.disabled) btnRegistrarVenta.click();
        break;
      case "{":
        if (!btnImprimirTicket?.disabled) btnImprimirTicket.click();
        break;
      case "}":
        btnCancelarVenta?.click();
        break;
      case "+":
      case "´":
        dniInput?.focus();
        break;
      default:
        isHot = false;
        break;
    }
    if (isHot) {
      event.preventDefault();
      return;
    }

    // Lectura de Enter contextual
    const active = document.activeElement;
    const typing =
      active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

    if (event.key === "Enter") {
      event.preventDefault();
      const mainVal = mainInput?.value?.trim();
      const barcodeVal = CajaState.barcodeBuffer.join("");
      if (active?.id === "main-input" && mainVal) {
        procesarEntrada(mainVal);
      } else if (active?.id === "monto-pagado") {
        btnRegistrarVenta?.click();
      } else if (active?.id === "dni-cliente") {
        btnBuscarCliente?.click();
      } else if (barcodeVal.length > 2) {
        procesarEntrada(barcodeVal);
      }
      CajaState.barcodeBuffer = [];
      clearTimeout(CajaState.barcodeTimer);
      return;
    }

    // buffer de lector si no estoy tipeando en inputs
    if (typing) return;
    if (event.key.length > 1) return;
    mainInput?.focus();
    CajaState.barcodeBuffer.push(event.key);
    clearTimeout(CajaState.barcodeTimer);
    CajaState.barcodeTimer = setTimeout(() => {
      if (CajaState.barcodeBuffer.length > 2) {
        procesarEntrada(CajaState.barcodeBuffer.join(""));
      }
      CajaState.barcodeBuffer = [];
    }, 200);
  });

  modalAcceptBtn?.addEventListener("click", hideErrorModal);

  btnBuscarCliente?.addEventListener("click", async () => {
    const dni = (dniInput?.value || "").trim();
    if (!dni) {
      CajaState.clienteActual = null;
      clienteInfo && (clienteInfo.textContent = "");
      renderizarVenta();
      return;
    }
    toggleButtonLoading(btnBuscarCliente, true, "Buscar");
    try {
      const cliente = await window.electronAPI.invoke(
        "get-cliente-by-dni",
        dni
      );
      if (cliente) {
        CajaState.clienteActual = cliente;
        clienteInfo &&
          (clienteInfo.textContent = `Cliente: ${cliente.nombre || dni} (${
            cliente.descuento || 0
          }% desc.)`);
      } else {
        CajaState.clienteActual = null;
        clienteInfo &&
          (clienteInfo.textContent = `Cliente no encontrado: ${dni}`);
      }
    } catch (e) {
      console.error("buscar cliente:", e);
      showErrorModal("No se pudo buscar el cliente.");
      CajaState.clienteActual = null;
      clienteInfo && (clienteInfo.textContent = "");
    } finally {
      toggleButtonLoading(btnBuscarCliente, false, "Buscar");
      renderizarVenta();
    }
  });

  tablaBody?.addEventListener("input", (e) => {
    if (!e.target.classList.contains("cantidad-input")) return;
    const index = parseInt(e.target.dataset.index, 10);
    const nueva = parseFloat(e.target.value);
    if (!isNaN(nueva) && nueva >= 0) {
      if (nueva === 0) CajaState.ventaActual.splice(index, 1);
      else CajaState.ventaActual[index].cantidad = nueva;
    } else {
      e.target.value = CajaState.ventaActual[index].cantidad;
    }
    renderizarVenta();
  });

  tablaBody?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-delete-item")) return;
    const index = parseInt(e.target.dataset.index, 10);
    CajaState.ventaActual.splice(index, 1);
    renderizarVenta();
  });

  paymentButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const metodo = button.dataset.metodo;
      if (metodo === "QR") {
        const totalString = totalDisplay?.textContent || "$0";
        const clean = totalString.replace(/[^\d,]/g, "").replace(",", ".");
        const total = parseFloat(clean) || 0;
        if (total <= 0) {
          showErrorModal("No hay un monto para cobrar.");
          return;
        }
        toggleButtonLoading(button, true, "QR");
        try {
          const result = await window.electronAPI.invoke("create-mp-order", {
            total,
          });
          if (result?.success) {
            window.electronAPI.send("open-qr-modal", {
              total,
              externalReference: result.externalReference,
            });
          } else {
            showErrorModal(
              `Error MP: ${result?.message || "fallo desconocido"}`
            );
          }
        } catch (e) {
          console.error("create-mp-order:", e);
          showErrorModal("Error de comunicación con Mercado Pago.");
        } finally {
          toggleButtonLoading(button, false, "QR");
        }
        return;
      }
      // Otros métodos
      CajaState.metodoPagoSeleccionado = metodo;
      paymentButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      if (metodo === "Efectivo") {
        efectivoArea?.classList.remove("oculto");
        montoPagadoInput?.focus();
      } else {
        efectivoArea?.classList.add("oculto");
      }
      renderizarVenta();
    });
  });

  montoPagadoInput?.addEventListener("input", actualizarCalculoVuelto);
  btnCancelarVenta?.addEventListener("click", resetearVenta);

  btnRegistrarVenta?.addEventListener("click", async () => {
    if (CajaState.ventaActual.length === 0) {
      showErrorModal("No hay productos en la venta.");
      return;
    }
    if (!CajaState.metodoPagoSeleccionado) {
      showErrorModal("Por favor, selecciona un método de pago.");
      return;
    }

    const debeFacturar = !!generarFacturaCheckbox?.checked;
    if (debeFacturar && !CajaState.clienteActual) {
      showErrorModal("Para generar una factura, debe asignar un cliente.");
      return;
    }

    toggleButtonLoading(btnRegistrarVenta, true, "Registrar Venta");

    const ventaData = {
      detalles: CajaState.ventaActual.map((i) => ({
        ProductoId: i.producto ? i.producto.id : null,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        nombreProducto: i.nombreProducto,
      })),
      metodoPago: CajaState.metodoPagoSeleccionado,
      ClienteId: CajaState.clienteActual?.id || null,
      dniCliente: CajaState.clienteActual?.dni || null,
      montoPagado: parseFloat(montoPagadoInput?.value) || 0,
      UsuarioId: CajaState.sesion?.user?.id || null,
      externalReference: CajaState.ultimaExternalReference,
    };

    try {
      const canal = debeFacturar
        ? "registrar-venta-y-facturar"
        : "registrar-venta";
      const result = await window.electronAPI.invoke(canal, ventaData);

      if (result?.success) {
        if (result.datosRecibo) {
          CajaState.ultimoReciboTexto = generarReciboTexto(
            result.ventaId,
            result.datosRecibo
          );
          btnImprimirTicket && (btnImprimirTicket.disabled = false);
        }
        if (result.datosPagoMP) {
          CajaState.ultimoMPPaymentId = result.datosPagoMP.id;
        }
        btnRegistrarVenta.disabled = true;
        mostrarModalVentaExitosa(result);
      } else {
        showErrorModal(
          `Error: ${result?.message || "No se pudo registrar la venta."}`
        );
        toggleButtonLoading(btnRegistrarVenta, false, "Registrar Venta");
      }
    } catch (e) {
      console.error("registrar-venta:", e);
      showErrorModal("Ocurrió un error crítico al registrar la venta.");
      toggleButtonLoading(btnRegistrarVenta, false, "Registrar Venta");
    }
  });

  btnImprimirTicket?.addEventListener("click", async () => {
    if (!CajaState.ultimoReciboTexto) {
      showErrorModal("No hay recibo para imprimir.");
      return;
    }
    const impresora = getCfg().impresora;
    if (!impresora) {
      showErrorModal("La impresora no está configurada.");
      return;
    }
    toggleButtonLoading(btnImprimirTicket, true, "Imprimir Ticket");
    try {
      const result = await window.electronAPI.invoke("imprimir-ticket", {
        recibo: CajaState.ultimoReciboTexto,
        nombreImpresora: impresora,
      });
      if (result?.success)
        showToast("✅ Ticket enviado a la impresora.", "success");
      else
        showErrorModal(
          `Error de impresión: ${result?.message || "desconocido"}`
        );
    } catch (e) {
      console.error("imprimir-ticket:", e);
      showErrorModal("Ocurrió un error crítico con el sistema de impresión.");
    } finally {
      toggleButtonLoading(btnImprimirTicket, false, "Imprimir Ticket");
      mainInput?.focus();
    }
  });

  // Eventos desde el proceso principal (Mercado Pago)
  window.electronAPI.on("mp-payment-approved", (externalReference) => {
    showToast("✅ ¡Pago Aprobado! Registrando la venta...", "success");
    CajaState.metodoPagoSeleccionado = "QR";
    CajaState.ultimaExternalReference = externalReference;
    paymentButtons.forEach((btn) => btn.classList.remove("active"));
    document.querySelector('button[data-metodo="QR"]')?.classList.add("active");
    setTimeout(() => btnRegistrarVenta?.click(), 300);
  });

  window.electronAPI.on("mp-payment-cancelled", () => {
    showErrorModal("El cobro con QR fue cancelado.");
    CajaState.metodoPagoSeleccionado = null;
    paymentButtons.forEach((btn) => btn.classList.remove("active"));
  });

  // Venta exitosa
  exBtnCerrar?.addEventListener("click", () => {
    ventaExitosaModal?.classList.remove("visible");
    resetearVenta();
  });

  exBtnImprimirMP?.addEventListener("click", async () => {
    if (!CajaState.ultimoMPPaymentId) return;
    toggleButtonLoading(exBtnImprimirMP, true, "Imprimir Comprobante MP");
    try {
      const result = await window.electronAPI.invoke(
        "imprimir-comprobante-mp",
        {
          paymentId: CajaState.ultimoMPPaymentId,
        }
      );
      if (result?.success)
        showToast("Comprobante enviado a la impresora.", "success");
      else
        showErrorModal(
          `Error al imprimir: ${result?.message || "desconocido"}`
        );
    } catch (e) {
      showErrorModal("Error de comunicación al imprimir el comprobante.");
    } finally {
      toggleButtonLoading(exBtnImprimirMP, false, "Imprimir Comprobante MP");
    }
  });

  // Arqueo
  abrirCajaBtn?.addEventListener("click", () => {
    if (!aperturaCajaModal) return;
    montoInicialInput && (montoInicialInput.value = "");
    aperturaCajaModal.classList.remove("oculto");
    montoInicialInput?.focus();
  });

  cancelarAperturaBtn?.addEventListener("click", () => {
    aperturaCajaModal?.classList.add("oculto");
  });

  aperturaCajaForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const montoInicial = parseFloat(montoInicialInput?.value);
    if (isNaN(montoInicial) || montoInicial < 0) {
      showToast("Por favor, ingresa un monto inicial válido.", "error");
      return;
    }
    const result = await window.electronAPI.invoke("abrir-caja", {
      montoInicial,
      usuarioId: CajaState.sesion?.user?.id,
    });
    if (result?.success) {
      CajaState.arqueoActual = result.arqueo;
      aperturaCajaModal?.classList.add("oculto");
      actualizarEstadoVisualCaja();
      showToast("Caja abierta exitosamente.");
    } else {
      showErrorModal(result?.message || "No se pudo abrir la caja.");
    }
  });

  cancelarCierreBtn?.addEventListener("click", () => {
    cierreCajaModal?.classList.add("oculto");
  });

  cierreCajaForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const montoFinalReal = parseFloat(montoFinalRealInput?.value);
    if (isNaN(montoFinalReal) || montoFinalReal < 0) {
      showToast(
        "Por favor, ingresa un monto final en efectivo válido.",
        "error"
      );
      return;
    }
    const result = await window.electronAPI.invoke("cerrar-caja", {
      arqueoId: CajaState.arqueoActual?.id,
      montoFinalReal,
      observaciones: (observacionesCierreInput?.value || "").trim(),
    });
    if (result?.success) {
      CajaState.arqueoActual = null;
      cierreCajaModal?.classList.add("oculto");
      actualizarEstadoVisualCaja();
      showToast("Caja cerrada exitosamente.");
    } else {
      showErrorModal(result?.message || "No se pudo cerrar la caja.");
    }
  });

  cerrarCajaBtn?.addEventListener("click", async () => {
    if (!CajaState.arqueoActual) return;
    if (!cierreCajaModal) return;

    resumenCierreCaja.innerHTML = `<p>Calculando resumen...</p>`;
    montoFinalRealInput && (montoFinalRealInput.value = "");
    observacionesCierreInput && (observacionesCierreInput.value = "");
    cierreCajaModal.classList.remove("oculto");

    const result = await window.electronAPI.invoke(
      "get-resumen-cierre",
      CajaState.arqueoActual.id
    );

    if (result?.success) {
      const { resumen } = result;
      resumenCierreCaja.innerHTML = `
        <p><strong>Monto Inicial:</strong> <span>${formatCurrency(
          resumen.montoInicial
        )}</span></p>
        <p><strong>Ventas en Efectivo:</strong> <span>${formatCurrency(
          resumen.totalEfectivo
        )}</span></p>
        <p><strong>Total Estimado en Caja:</strong> <span>${formatCurrency(
          resumen.montoEstimado
        )}</span></p>
        <hr>
        <p><strong>Ventas (Otros Métodos):</strong> <span>${formatCurrency(
          (resumen.totalDebito || 0) +
            (resumen.totalCredito || 0) +
            (resumen.totalQR || 0)
        )}</span></p>
      `;
      if (montoFinalRealInput)
        montoFinalRealInput.value = (resumen.montoEstimado || 0).toFixed(2);
    } else {
      resumenCierreCaja.innerHTML = `<p style="color:red;">Error al calcular: ${
        result?.message || "desconocido"
      }</p>`;
    }
    montoFinalRealInput?.focus();
  });

  // --- ARRANQUE ---
  inicializarPagina();
});
