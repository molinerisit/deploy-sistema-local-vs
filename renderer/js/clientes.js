// renderer/js/clientes.js
document.addEventListener("app-ready", () => {
  // --- Refs ---
  const tablaBody = document.querySelector("#clientes-table tbody");
  const modal = document.getElementById("cliente-modal");
  const modalTitulo = document.getElementById("modal-titulo");
  const clienteForm = document.getElementById("cliente-form");
  const btnNuevoCliente = document.getElementById("btn-nuevo-cliente");
  const btnCancelarModal = document.getElementById("btn-cancelar-modal");
  const inputId = document.getElementById("cliente-id");
  const inputDni = document.getElementById("dni");
  const inputNombre = document.getElementById("nombre");
  const inputDescuento = document.getElementById("descuento");
  const btnGuardar = document.getElementById("btn-guardar-cliente"); // ahora con ID explícito
  const toast = document.getElementById("toast-notification");

  let toastTimer;

  // --- Utils ---
  const showNotification = (message, type = "success") => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast";
    toast.classList.add(type, "visible");
    toastTimer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 3000);
  };

  const bloquearFondo = (activar) => {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (activar) {
      main.setAttribute("inert", ""); // evita focos/inputs detrás del modal
      document.body.style.overflow = "hidden";
      modal?.setAttribute("aria-hidden", "false");
    } else {
      main.removeAttribute("inert");
      document.body.style.overflow = "";
      modal?.setAttribute("aria-hidden", "true");
    }
  };

  const cerrarModal = () => {
    modal?.classList.remove("visible");
    bloquearFondo(false);
    // Evita que quede un input “activo” y la UI se sienta bloqueada
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  };

  const abrirModal = (cliente = null) => {
    clienteForm?.reset();
    if (cliente) {
      modalTitulo.textContent = "Editar Cliente";
      inputId.value = cliente.id;
      inputDni.value = cliente.dni;
      inputNombre.value = cliente.nombre;
      inputDescuento.value = cliente.descuento || 0;
    } else {
      modalTitulo.textContent = "Nuevo Cliente";
      inputId.value = "";
      inputDescuento.value = "0";
    }
    modal?.classList.add("visible");
    bloquearFondo(true);
    inputDni?.focus();
  };

  const cargarClientes = async () => {
    try {
      const lista = await window.electronAPI.invoke("get-clientes");
      if (!lista || lista.length === 0) {
        tablaBody.innerHTML =
          '<tr><td colspan="4" class="text-center">No se encontraron clientes.</td></tr>';
        return;
      }
      tablaBody.innerHTML = lista
        .map(
          (c) => `
            <tr>
              <td>${c.dni}</td>
              <td>${c.nombre}</td>
              <td>${c.descuento || 0}%</td>
              <td class="acciones-btn">
                <button class="btn-edit btn btn-info" data-id="${c.id}" title="Editar">✏️</button>
                <button class="btn-delete btn btn-danger" data-id="${c.id}" title="Eliminar">🗑️</button>
              </td>
            </tr>`
        )
        .join("");
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      showNotification("No se pudieron cargar los clientes.", "error");
    }
  };

  // Fallback: si el handler 'get-cliente-by-id' no existe, buscamos en memoria
  const cargarClientePorId = async (id) => {
    try {
      const cliente = await window.electronAPI.invoke("get-cliente-by-id", id);
      if (cliente) return cliente;
    } catch (_) {
      // Canal inexistente o error: hacemos fallback
    }
    try {
      const lista = await window.electronAPI.invoke("get-clientes");
      return lista.find((c) => c.id === id) || null;
    } catch (e) {
      return null;
    }
  };

  // --- Listeners ---
  btnNuevoCliente?.addEventListener("click", () => abrirModal());
  btnCancelarModal?.addEventListener("click", cerrarModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });

  clienteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!btnGuardar) return;

    btnGuardar.disabled = true;

    const clienteData = {
      dni: (inputDni.value || "").trim(),
      nombre: (inputNombre.value || "").trim(),
      descuento: parseFloat(inputDescuento.value) || 0,
    };
    if (inputId.value) clienteData.id = inputId.value;

    try {
      const result = await window.electronAPI.invoke("guardar-cliente", clienteData);
      if (result?.success) {
        showNotification("Cliente guardado con éxito.");
        cerrarModal();
        await cargarClientes();
      } else {
        showNotification(
          `Error al guardar: ${result?.message || "Error desconocido"}`,
          "error"
        );
      }
    } catch (error) {
      showNotification("Ocurrió un error inesperado al guardar.", "error");
    } finally {
      btnGuardar.disabled = false;
    }
  });

  tablaBody?.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const clienteId = target.dataset.id;
    if (!clienteId) return;

    if (target.classList.contains("btn-edit")) {
      const clienteAEditar = await cargarClientePorId(clienteId);
      if (clienteAEditar) abrirModal(clienteAEditar);
      else showNotification("No se encontró el cliente.", "error");
      return;
    }

    if (target.classList.contains("btn-delete")) {
      if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;
      target.disabled = true;
      try {
        const result = await window.electronAPI.invoke("eliminar-cliente", clienteId);
        if (result?.success) {
          showNotification("Cliente eliminado.");
          await cargarClientes();
        } else {
          showNotification(`Error al eliminar: ${result?.message || "desconocido"}`, "error");
        }
      } catch (error) {
        showNotification("Ocurrió un error inesperado al eliminar.", "error");
      } finally {
        target.disabled = false;
      }
    }
  });

  // --- Arranque ---
  cargarClientes();
});
