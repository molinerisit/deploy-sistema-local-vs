// renderer/js/proveedor-form.js (VERSIÓN FINAL CON TOASTS)
document.addEventListener("app-ready", () => { // Cambiado a app-ready por consistencia
  // --- 1. REFERENCIAS ---
  const proveedorForm = document.getElementById("proveedor-form");
  const formTitulo = document.getElementById("form-titulo");
  const btnSubmit = document.getElementById("btn-guardar-proveedor");
  const inputId = document.getElementById("proveedor-id");
  const inputNombreEmpresa = document.getElementById("nombreEmpresa");
  const inputNombreRepartidor = document.getElementById("nombreRepartidor");
  const inputTelefono = document.getElementById("telefono");
  const inputDiasReparto = document.getElementById("diasReparto");
  const tipoSelect = document.getElementById("proveedor-tipo");
  const productosCheckboxContainer = document.getElementById(
    "lista-productos-checkbox"
  );
  const insumosCheckboxContainer = document.getElementById(
    "lista-insumos-checkbox"
  );
  const fieldsetProductos = document.getElementById("fieldset-productos");
  const fieldsetInsumos = document.getElementById("fieldset-insumos");
  const inputLimitePedido = document.getElementById("limitePedido");

  // Referencia al elemento de notificación (toast)
  const toast = document.getElementById('toast-notification');
  let toastTimer;

  // --- 2. FUNCIONES ---
  const showNotification = (message, type = "success") => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.add('visible');
    toastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
  };

  const toggleSubmitButtonState = (isLoading) => {
    if (btnSubmit) {
      btnSubmit.disabled = isLoading;
      btnSubmit.textContent = isLoading ? "Guardando..." : "Guardar Proveedor";
    }
  };
  const actualizarVisibilidadFieldsets = () => {
    const tipo = tipoSelect.value;
    fieldsetProductos.style.display =
      tipo === "producto" || tipo === "ambos" ? "block" : "none";
    fieldsetInsumos.style.display =
      tipo === "insumos" || tipo === "ambos" ? "block" : "none";
  };

  const poblarFormulario = (proveedor) => {
    inputId.value = proveedor.id;
    inputNombreEmpresa.value = proveedor.nombreEmpresa;
    inputNombreRepartidor.value = proveedor.nombreRepartidor || "";
    inputTelefono.value = proveedor.telefono || "";
    inputDiasReparto.value = proveedor.diasReparto || "";
    inputLimitePedido.value = proveedor.limitePedido || "";
    tipoSelect.value = proveedor.tipo;
    if (proveedor.productoIds) {
      proveedor.productoIds.forEach((id) => {
        const checkbox = document.querySelector(
          `#lista-productos-checkbox input[value="${id}"]`
        );
        if (checkbox) checkbox.checked = true;
      });
    }
    if (proveedor.insumoIds) {
      proveedor.insumoIds.forEach((id) => {
        const checkbox = document.querySelector(
          `#lista-insumos-checkbox input[value="${id}"]`
        );
        if (checkbox) checkbox.checked = true;
      });
    }
    actualizarVisibilidadFieldsets();
  };

  const inicializarFormulario = async () => {
    try {
      const { productos, insumos } = await window.electronAPI.invoke(
        "get-productos-insumos"
      );
      productosCheckboxContainer.innerHTML = productos
        .map(
          (p) =>
            `<div class="checkbox-item"><input type="checkbox" id="prod-${p.id}" name="productos" value="${p.id}"><label for="prod-${p.id}">${p.nombre}</label></div>`
        )
        .join("");
      insumosCheckboxContainer.innerHTML = insumos
        .map(
          (i) =>
            `<div class="checkbox-item"><input type="checkbox" id="insumo-${i.id}" name="insumos" value="${i.id}"><label for="insumo-${i.id}">${i.nombre}</label></div>`
        )
        .join("");

      const urlParams = new URLSearchParams(window.location.search);
      const proveedorId = urlParams.get("id");

      if (proveedorId) {
        formTitulo.textContent = "Editar Proveedor";
        const proveedor = await window.electronAPI.invoke(
          "get-proveedor-by-id",
          proveedorId
        );
        if (proveedor) {
          poblarFormulario(proveedor);
        } else {
          showNotification(
            "Error: No se encontró el proveedor para editar.",
            "error"
          );
          formTitulo.textContent = "Proveedor no encontrado";
          proveedorForm.style.display = "none";
        }
      } else {
        formTitulo.textContent = "Nuevo Proveedor";
        actualizarVisibilidadFieldsets();
      }
    } catch (error) {
      console.error("Error al inicializar el formulario:", error);
      showNotification(
        "Error crítico al cargar los datos del formulario.",
        "error"
      );
    }
  };

  // --- 3. EVENT LISTENERS ---
  tipoSelect.addEventListener("change", actualizarVisibilidadFieldsets);

  proveedorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    toggleSubmitButtonState(true);

    const productoIds = Array.from(
      productosCheckboxContainer.querySelectorAll("input:checked")
    ).map((cb) => cb.value);
    const insumoIds = Array.from(
      insumosCheckboxContainer.querySelectorAll("input:checked")
    ).map((cb) => cb.value);

    const proveedorData = {
      nombreEmpresa: inputNombreEmpresa.value.trim(),
      nombreRepartidor: inputNombreRepartidor.value.trim(),
      telefono: inputTelefono.value.trim(),
      diasReparto: inputDiasReparto.value.trim(),
      limitePedido: inputLimitePedido.value.trim(),
      tipo: tipoSelect.value,
    };

    const idValue = inputId.value;
    if (idValue) {
      proveedorData.id = idValue;
    }

    try {
      const result = await window.electronAPI.invoke("guardar-proveedor", {
        proveedorData,
        productoIds,
        insumoIds,
      });
      if (result.success) {
        showNotification("Proveedor guardado con éxito.");
        setTimeout(() => {
          window.location.href = "proveedores.html";
        }, 1200); // Dar tiempo para leer el toast
      } else {
        showNotification(`Error al guardar: ${result.message}`, "error");
      }
    } catch (error) {
      showNotification("Error inesperado al guardar.", "error");
    } finally {
      toggleSubmitButtonState(false);
    }
  });

  // --- ARRANQUE ---
  inicializarFormulario();
});