// renderer/js/producto-form.js (PLU strategy + pesable + extracción desde código)
document.addEventListener("app-ready", () => {
  // --- 1. REFERENCIAS ---
  const productoForm = document.getElementById("producto-form");
  const formTitulo = document.getElementById("form-titulo");
  const btnSubmit = document.getElementById("btn-guardar-producto");
  const inputId = document.getElementById("producto-id");
  const inputNombre = document.getElementById("nombre");
  const inputCodigoBarras = document.getElementById("codigo_barras");
  const deptoSelect = document.getElementById("departamento-select");
  const familiaSelect = document.getElementById("familia-select");
  const btnNuevoDepto = document.getElementById("btn-nuevo-depto");
  const btnNuevaFamilia = document.getElementById("btn-nueva-familia");
  const inputStock = document.getElementById("stock");
  const inputUnidad = document.getElementById("unidad");
  const inputFechaVencimiento = document.getElementById("fecha_vencimiento");
  const inputPrecioCompra = document.getElementById("precioCompra");
  const inputPrecioVenta = document.getElementById("precioVenta");
  const inputImagenProducto = document.getElementById("imagen_producto");
  const imagenPreview = document.getElementById("imagen-preview");
  const gananciaDisplay = document.getElementById("ganancia-unidad");
  const margenDisplay = document.getElementById("margen-ganancia");
  const toast = document.getElementById("toast-notification");
  let toastTimer;

  // NUEVO: Balanza/PLU
  const pesableChk = document.getElementById("pesable");
  const pluRow = document.getElementById("plu-row");
  const pluInput = document.getElementById("plu");
  const pluHelp = document.getElementById("plu-help");

  // Elementos del formulario inline de Departamento
  const nuevoDeptoContainer = document.getElementById("nuevo-depto-container");
  const nuevoDeptoNombre = document.getElementById("nuevo-depto-nombre");
  const btnGuardarDepto = document.getElementById("btn-guardar-depto");
  const btnCancelarDepto = document.getElementById("btn-cancelar-depto");

  // Elementos del formulario inline de Familia
  const nuevaFamiliaContainer = document.getElementById("nueva-familia-container");
  const nuevaFamiliaNombre = document.getElementById("nueva-familia-nombre");
  const btnGuardarFamilia = document.getElementById("btn-guardar-familia");
  const btnCancelarFamilia = document.getElementById("btn-cancelar-familia");

  // --- 2. ESTADO Y FUNCIONES ---
  let departamentosData = [];
  let familiasData = [];
  let imagenBase64 = null;

  // Balanza/PLU strategy & formato
  let balanzaFormato = null;     // {prefijo,tipo_valor,valor_divisor,codigo_inicio,codigo_longitud,...}
  let pluStrategy = "ninguno";   // "ninguno" | "=codigo_barras" | "manual"

  const showNotification = (message, type = "success") => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast";
    toast.classList.add(type, "visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
  };

  const toggleSubmitButtonState = (isLoading) => {
    if (!btnSubmit) return;
    btnSubmit.disabled = isLoading;
    btnSubmit.textContent = isLoading ? "Guardando..." : "Guardar Producto";
  };

  const calcularRentabilidad = () => {
    const compra = parseFloat(inputPrecioCompra.value) || 0;
    const venta = parseFloat(inputPrecioVenta.value) || 0;
    const ganancia = venta - compra;
    const margen = venta > 0 ? (ganancia / venta) * 100 : 0;
    gananciaDisplay.textContent = `$${ganancia.toFixed(2)}`;
    margenDisplay.textContent = `${margen.toFixed(0)}%`;
  };

  const cargarClasificaciones = async () => {
    try {
      const data = await window.electronAPI.invoke("get-clasificaciones");
      departamentosData = data.departamentos || [];
      familiasData = data.familias || [];
      renderizarDepartamentos();
    } catch (e) {
      showNotification("No se pudieron cargar las categorías.", "error");
    }
  };

  const renderizarDepartamentos = (idSeleccionar = null) => {
    deptoSelect.innerHTML = '<option value="">-- Departamento --</option>';
    departamentosData.forEach((depto) => {
      deptoSelect.innerHTML += `<option value="${depto.id}">${depto.nombre}</option>`;
    });
    if (idSeleccionar) deptoSelect.value = idSeleccionar;
  };

  const actualizarFamiliasSelect = (familiaASeleccionarId = null) => {
    const deptoId = deptoSelect.value;
    familiaSelect.innerHTML = '<option value="">-- Familia --</option>';
    familiaSelect.disabled = !deptoId;
    btnNuevaFamilia.disabled = !deptoId;
    if (deptoId) {
      const familiasFiltradas = familiasData.filter(
        (f) => String(f.DepartamentoId) === String(deptoId)
      );
      familiasFiltradas.forEach((fam) => {
        familiaSelect.innerHTML += `<option value="${fam.id}">${fam.nombre}</option>`;
      });
    }
    if (familiaASeleccionarId) familiaSelect.value = familiaASeleccionarId;
  };

  // --- Balanza / PLU helpers ---
  const extractPluFromBarcode = (barcode) => {
    if (!balanzaFormato || !barcode) return "";
    const start = (parseInt(balanzaFormato.codigo_inicio || 3) - 1) || 0;
    const len = parseInt(balanzaFormato.codigo_longitud || 5) || 0;
    if (!len) return "";
    if (barcode.length < start + len) return "";
    return barcode.substring(start, start + len);
  };

  const refreshPluUI = () => {
    const isPesable = !!pesableChk?.checked;

    if (!isPesable || pluStrategy === "ninguno") {
      if (pluRow) pluRow.style.display = "none";
      return;
    }

    // mostrar fila PLU
    pluRow.style.display = "";

    if (pluStrategy === "=codigo_barras") {
      const auto = extractPluFromBarcode(inputCodigoBarras.value || "");
      pluInput.value = auto;
      pluInput.readOnly = true;
      pluHelp.textContent = auto
        ? "PLU extraído automáticamente del código de barras (según formato configurado)."
        : "No se pudo extraer el PLU. Revisá el formato en Admin → Balanza.";
    } else {
      // manual
      pluInput.readOnly = false;
      pluHelp.textContent = "Ingresá el PLU que tendrá este producto en la balanza.";
    }
  };

  const loadAdminConfig = async () => {
    try {
      const cfg = await window.electronAPI.invoke("get-admin-config");
      const bc = cfg?.config_balanza || {};
      balanzaFormato = {
        prefijo: bc.prefijo ?? "20",
        tipo_valor: bc.tipo_valor ?? "peso",
        valor_divisor: parseInt(bc.valor_divisor ?? 1000),
        codigo_inicio: parseInt(bc.codigo_inicio ?? 3),
        codigo_longitud: parseInt(bc.codigo_longitud ?? 5),
        valor_inicio: parseInt(bc.valor_inicio ?? 8),
        valor_longitud: parseInt(bc.valor_longitud ?? 5),
      };
      const sc = cfg?.config_balanza_conexion || {};
      pluStrategy = sc.pluStrategy || "ninguno"; // "ninguno" | "=codigo_barras" | "manual"
    } catch (e) {
      console.warn("No se pudo leer config admin:", e);
    }
  };

  const poblarFormulario = (producto) => {
    inputId.value = producto.id;
    inputNombre.value = producto.nombre || "";
    inputCodigoBarras.value = producto.codigo_barras || "";
    inputStock.value = producto.stock ?? 0;
    inputUnidad.value = producto.unidad || "unidad";
    inputPrecioCompra.value = producto.precioCompra ?? 0;
    inputPrecioVenta.value = producto.precioVenta ?? 0;
    inputFechaVencimiento.value = producto.fecha_vencimiento || "";

    // Imagen
    if (producto.imagen_url) {
      imagenPreview.src = `app://${String(producto.imagen_url).replace(/\\/g, "/")}`;
      imagenPreview.classList.remove("imagen-preview-oculta");
    }

    // Clasificación
    deptoSelect.value = producto.familia?.DepartamentoId || "";
    actualizarFamiliasSelect(producto.FamiliaId || null);

    // Pesable / PLU
    pesableChk.checked = !!producto.pesable;
    if (producto.plu) pluInput.value = producto.plu;

    calcularRentabilidad();
    refreshPluUI();
  };

  const inicializar = async () => {
    await loadAdminConfig();
    await cargarClasificaciones();

    const urlParams = new URLSearchParams(window.location.search);
    const productoId = urlParams.get("id");

    if (productoId) {
      formTitulo.textContent = "Editar Producto";
      const producto = await window.electronAPI.invoke("get-producto-by-id", productoId);
      if (producto) poblarFormulario(producto);
      else showNotification("Error: No se encontró el producto.", "error");
    } else {
      formTitulo.textContent = "Nuevo Producto";
      actualizarFamiliasSelect();
      refreshPluUI();
    }
  };

  // --- 4. EVENT LISTENERS ---
  inputPrecioCompra.addEventListener("input", calcularRentabilidad);
  inputPrecioVenta.addEventListener("input", calcularRentabilidad);
  deptoSelect.addEventListener("change", () => actualizarFamiliasSelect());

  // Imagen preview
  inputImagenProducto.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      imagenPreview.classList.add("imagen-preview-oculta");
      imagenBase64 = null;
      return;
    }
    const reader = new FileReader();
    reader.onload = (re) => {
      imagenPreview.src = re.target.result;
      imagenPreview.classList.remove("imagen-preview-oculta");
      // guardamos toda la URL base64 (data:image/..;base64,xxx) para que el backend la parsee
      imagenBase64 = re.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Balanza / PLU UI
  pesableChk.addEventListener("change", refreshPluUI);
  inputCodigoBarras.addEventListener("input", () => {
    if (pluStrategy === "=codigo_barras" && pesableChk.checked) {
      refreshPluUI();
    }
  });

  // NUEVO DEPTO
  btnNuevoDepto.addEventListener("click", () => {
    nuevaFamiliaContainer.style.display = "none";
    nuevoDeptoContainer.style.display = "flex";
    nuevoDeptoNombre.focus();
  });
  btnCancelarDepto.addEventListener("click", () => {
    nuevoDeptoContainer.style.display = "none";
  });
  btnGuardarDepto.addEventListener("click", async () => {
    const nombre = (nuevoDeptoNombre.value || "").trim();
    if (!nombre) return showNotification("El nombre no puede estar vacío.", "error");

    const res = await window.electronAPI.invoke("guardar-departamento", { nombre });
    if (res?.success) {
      departamentosData.push(res.data);
      renderizarDepartamentos(res.data.id);
      deptoSelect.dispatchEvent(new Event("change"));
      nuevoDeptoNombre.value = "";
      nuevoDeptoContainer.style.display = "none";
      showNotification("Departamento creado.");
    } else {
      showNotification(`Error: ${res?.message || "No se pudo crear el departamento."}`, "error");
    }
  });

  // NUEVA FAMILIA
  btnNuevaFamilia.addEventListener("click", () => {
    if (!deptoSelect.value) return showNotification("Seleccione un departamento primero.", "error");
    nuevoDeptoContainer.style.display = "none";
    nuevaFamiliaContainer.style.display = "flex";
    nuevaFamiliaNombre.focus();
  });
  btnCancelarFamilia.addEventListener("click", () => {
    nuevaFamiliaContainer.style.display = "none";
  });
  btnGuardarFamilia.addEventListener("click", async () => {
    const nombre = (nuevaFamiliaNombre.value || "").trim();
    const DepartamentoId = deptoSelect.value;
    if (!nombre) return showNotification("El nombre no puede estar vacío.", "error");

    const res = await window.electronAPI.invoke("guardar-familia", { nombre, DepartamentoId });
    if (res?.success) {
      familiasData.push(res.data);
      actualizarFamiliasSelect(res.data.id);
      nuevaFamiliaNombre.value = "";
      nuevaFamiliaContainer.style.display = "none";
      showNotification("Familia creada.");
    } else {
      showNotification(`Error: ${res?.message || "No se pudo crear la familia."}`, "error");
    }
  });

  // GUARDAR PRODUCTO
  productoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    toggleSubmitButtonState(true);

    try {
      // Resolver PLU según estrategia
      let pluToSend = null;
      const isPesable = !!pesableChk.checked;

      if (isPesable) {
        if (pluStrategy === "manual") {
          const v = (pluInput.value || "").trim();
          if (!v) {
            toggleSubmitButtonState(false);
            return showNotification("PLU requerido (estrategia manual).", "error");
          }
          pluToSend = v;
        } else if (pluStrategy === "=codigo_barras") {
          const auto = extractPluFromBarcode((inputCodigoBarras.value || "").trim());
          if (!auto) {
            toggleSubmitButtonState(false);
            return showNotification("No se pudo extraer el PLU del código de barras. Revisá Admin → Balanza.", "error");
          }
          pluToSend = auto;
        } else {
          // "ninguno": no se envía PLU
          pluToSend = null;
        }
      }

      const productoData = {
        nombre: inputNombre.value.trim(),
        stock: parseFloat(inputStock.value) || 0,
        unidad: inputUnidad.value || "unidad",
        precioCompra: parseFloat(inputPrecioCompra.value) || 0,
        precioVenta: parseFloat(inputPrecioVenta.value) || 0,
        codigo_barras: (inputCodigoBarras.value || "").trim() || null,
        fecha_vencimiento: inputFechaVencimiento.value || null,
        FamiliaId: familiaSelect.value || null,
        imagen_base64: imagenBase64, // backend la convierte a archivo si viene
        activo: true,
        pesable: isPesable,
        plu: pluToSend,
      };

      if (inputId.value) {
        productoData.id = inputId.value;
      }

      const result = await window.electronAPI.invoke("guardar-producto", productoData);
      if (result?.success) {
        // Opcional: empujar a balanza si corresponde
        if (isPesable && pluToSend) {
          try {
            await window.electronAPI.invoke("scale-upsert-plu", {
              plu: pluToSend,
              name: productoData.nombre,
              price: Math.round((productoData.precioVenta || 0) * 100), // centavos
              tare: 0,
              barcode: productoData.codigo_barras || null,
            });
          } catch (err) {
            console.warn("No se pudo sincronizar con balanza en este momento:", err);
          }
        }

        showNotification("¡Producto guardado con éxito!", "success");
        setTimeout(() => (window.location.href = "productos.html"), 900);
      } else {
        showNotification(`Error: ${result?.message || "No se pudo guardar el producto."}`, "error");
      }
    } catch (error) {
      console.error(error);
      showNotification("Ocurrió un error inesperado.", "error");
    } finally {
      toggleSubmitButtonState(false);
    }
  });

  // --- ARRANQUE ---
  (async () => {
    await inicializar();
    // recalcular margen al inicio por si hay valores precargados
    calcularRentabilidad();
  })();
});
