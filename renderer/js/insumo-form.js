// renderer/js/insumo-form.js (VERSIÓN FINAL CON NOTIFICACIONES NO BLOQUEANTES)
document.addEventListener("app-ready", () => {
  // --- 1. REFERENCIAS ---
  const insumoForm = document.getElementById("insumo-form");
  const formTitulo = document.getElementById("form-titulo");
  const btnSubmit = document.getElementById("btn-guardar-insumo");
  const inputId = document.getElementById("insumo-id");
  const inputNombre = document.getElementById("nombre");
  const inputStock = document.getElementById("stock");
  const inputUnidad = document.getElementById("unidad");
  const inputCosto = document.getElementById("ultimoPrecioCompra");
  const deptoSelect = document.getElementById("departamento-select");
  const familiaSelect = document.getElementById("familia-select");

  // Botones principales '+'
  const btnNuevoDepto = document.getElementById("btn-nuevo-depto");
  const btnNuevaFamilia = document.getElementById("btn-nueva-familia");
  
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

  // Referencia al elemento de notificación (toast)
  const toast = document.getElementById('toast-notification');
  let toastTimer; // Variable para controlar el temporizador de la notificación

  // --- 2. ESTADO Y FUNCIONES ---
  let departamentosData = [];
  let familiasData = [];

  // Función de notificaciones "Toast" (NO BLOQUEANTE)
  const showNotification = (message, type = "success") => {
    if (!toast) return; // Salir si el elemento del toast no existe
    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = 'toast'; // Resetea clases
    toast.classList.add(type); // Añade 'success' o 'error'
    
    toast.classList.add('visible');

    toastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000); // La notificación se oculta sola después de 3 segundos
  };

  const toggleSubmitButtonState = (isLoading) => {
    if (btnSubmit) {
      btnSubmit.disabled = isLoading;
      btnSubmit.textContent = isLoading ? "Guardando..." : "Guardar Insumo";
    }
  };

  const cargarClasificaciones = async () => {
    try {
      const data = await window.electronAPI.invoke("get-insumo-clasificaciones");
      departamentosData = data.departamentos;
      familiasData = data.familias;
      renderizarDepartamentos();
    } catch (e) {
      showNotification("No se pudieron cargar las categorías.", "error");
    }
  };

  const renderizarDepartamentos = (idSeleccionar = null) => {
    deptoSelect.innerHTML = '<option value="">-- Departamento --</option>';
    departamentosData.forEach((depto) => {
      deptoSelect.innerHTML += `<option value="${depto.id}">${depto.nombre}</option>`
    });
    if (idSeleccionar) deptoSelect.value = idSeleccionar;
  };
  
  const actualizarFamiliasSelect = (familiaASeleccionarId = null) => {
    const deptoId = deptoSelect.value;
    familiaSelect.innerHTML = '<option value="">-- Familia --</option>';
    familiaSelect.disabled = !deptoId;
    btnNuevaFamilia.disabled = !deptoId;
    if (deptoId) {
      const familiasFiltradas = familiasData.filter((f) => f.InsumoDepartamentoId == deptoId);
      familiasFiltradas.forEach((fam) => {
        familiaSelect.innerHTML += `<option value="${fam.id}">${fam.nombre}</option>`
      });
    }
    if (familiaASeleccionarId) familiaSelect.value = familiaASeleccionarId;
  };

  const poblarFormulario = (insumo) => {
    inputId.value = insumo.id;
    inputNombre.value = insumo.nombre;
    inputStock.value = insumo.stock || 0;
    inputUnidad.value = insumo.unidad || "unidad";
    inputCosto.value = insumo.ultimoPrecioCompra || 0;
    deptoSelect.value = insumo.InsumoDepartamentoId || "";
    actualizarFamiliasSelect(insumo.InsumoFamiliaId);
  };

  const inicializar = async () => {
    await cargarClasificaciones();
    const urlParams = new URLSearchParams(window.location.search);
    const insumoId = urlParams.get("id");
    if (insumoId) {
      formTitulo.textContent = "Editar Insumo";
      inputStock.setAttribute("readonly", true);
      const insumo = await window.electronAPI.invoke("get-insumo-by-id", insumoId);
      if (insumo) poblarFormulario(insumo);
      else {
        showNotification("Error: No se encontró el insumo.", "error");
        formTitulo.textContent = "Insumo no encontrado";
      }
    } else {
      formTitulo.textContent = "Nuevo Insumo";
      inputStock.removeAttribute("readonly");
      actualizarFamiliasSelect();
    }
  };

  // --- 3. EVENT LISTENERS ---
  
  deptoSelect.addEventListener("change", () => actualizarFamiliasSelect());

  // --- LÓGICA PARA FORMULARIOS INLINE ---

  btnNuevoDepto.addEventListener('click', () => {
    nuevaFamiliaContainer.style.display = 'none'; // Oculta el otro por si acaso
    nuevoDeptoContainer.style.display = 'flex';
    nuevoDeptoNombre.focus();
  });

  btnCancelarDepto.addEventListener('click', () => {
    nuevoDeptoContainer.style.display = 'none';
  });

  btnGuardarDepto.addEventListener('click', async () => {
    const nombre = nuevoDeptoNombre.value.trim();
    if (!nombre) {
      showNotification("El nombre del departamento no puede estar vacío.", "error");
      return;
    }
    const res = await window.electronAPI.invoke("guardar-insumo-departamento", { nombre });
    if (res.success) {
      departamentosData.push(res.data);
      renderizarDepartamentos(res.data.id); 
      deptoSelect.dispatchEvent(new Event('change')); 
      nuevoDeptoNombre.value = '';
      nuevoDeptoContainer.style.display = 'none';
      showNotification("Departamento creado con éxito.");
    } else {
      showNotification(`Error: ${res.message}`, "error");
    }
  });

  btnNuevaFamilia.addEventListener('click', () => {
    const deptoId = deptoSelect.value;
    if (!deptoId) {
      showNotification("Seleccione un departamento primero.", "error");
      return;
    }
    nuevoDeptoContainer.style.display = 'none'; 
    nuevaFamiliaContainer.style.display = 'flex';
    nuevaFamiliaNombre.focus();
  });

  btnCancelarFamilia.addEventListener('click', () => {
    nuevaFamiliaContainer.style.display = 'none';
  });

  btnGuardarFamilia.addEventListener('click', async () => {
    const nombre = nuevaFamiliaNombre.value.trim();
    const InsumoDepartamentoId = deptoSelect.value;
    if (!nombre) {
      showNotification("El nombre de la familia no puede estar vacío.", "error");
      return;
    }
    const res = await window.electronAPI.invoke("guardar-insumo-familia", { nombre, InsumoDepartamentoId });
    if (res.success) {
      familiasData.push(res.data);
      actualizarFamiliasSelect(res.data.id); 
      nuevaFamiliaNombre.value = '';
      nuevaFamiliaContainer.style.display = 'none';
      showNotification("Familia creada con éxito.");
    } else {
      showNotification(`Error: ${res.message}`, "error");
    }
  });

  // --- SUBMIT DEL FORMULARIO PRINCIPAL ---

  insumoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    toggleSubmitButtonState(true);
    const data = {
      nombre: inputNombre.value.trim(),
      unidad: inputUnidad.value.trim(),
      ultimoPrecioCompra: parseFloat(inputCosto.value) || 0,
      InsumoDepartamentoId: deptoSelect.value || null,
      InsumoFamiliaId: familiaSelect.value || null,
    };
    if (inputId.value) {
      data.id = inputId.value;
    } else {
      data.stock = parseFloat(inputStock.value) || 0;
    }
    try {
      const result = await window.electronAPI.invoke("guardar-insumo", data);
      if (result.success) {
        showNotification("Insumo guardado con éxito.");
        setTimeout(() => { window.location.href = "insumos.html"; }, 1200); // Damos un poco más de tiempo para leer el toast
      } else {
        showNotification(`Error: ${result.message}`, "error");
      }
    } catch (err) {
      showNotification("Error inesperado al guardar.", "error");
    } finally {
      toggleSubmitButtonState(false);
    }
  });

  // --- ARRANQUE ---
  inicializar();
});