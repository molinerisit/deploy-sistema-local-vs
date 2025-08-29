// renderer/js/productos.js (VERSIÓN FINAL CON NOTIFICACIONES NO BLOQUEANTES)
document.addEventListener("app-ready", () => {
  // --- 1. REFERENCIAS ---
  const tablaBody = document.getElementById("productos-table-body");
  const btnNuevoProducto = document.getElementById("btn-nuevo-producto");
  const searchInput = document.getElementById("search-input");
  const alertasContainer = document.getElementById("alertas-container");
  const toast = document.getElementById('toast-notification');
  let toastTimer;

  // --- 2. ESTADO ---
  let listaDeProductos = [];
  let isProcessing = false;

  // --- 3. FUNCIONES ---
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
  
  const verificarYMostrarAlertas = (productos) => {
    if (!alertasContainer) return;
    alertasContainer.innerHTML = '';
    const LIMITE_STOCK_BAJO = 5;
    const DIAS_PARA_VENCIMIENTO = 7;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limiteVencimiento = new Date();
    limiteVencimiento.setDate(hoy.getDate() + DIAS_PARA_VENCIMIENTO);
    const productosBajoStock = productos.filter(p => p.activo && p.stock > 0 && p.stock < LIMITE_STOCK_BAJO);
    const productosProximosAVencer = productos.filter(p => {
        if (!p.activo || !p.fecha_vencimiento) return false;
        const fechaVencimiento = new Date(p.fecha_vencimiento + 'T00:00:00');
        return fechaVencimiento >= hoy && fechaVencimiento <= limiteVencimiento;
    });
    const crearAlertaHTML = (mensaje, tipo) => {
        const alertaDiv = document.createElement('div');
        alertaDiv.className = `alerta ${tipo}`;
        alertaDiv.innerHTML = `<span>${mensaje}</span><button class="alerta-cerrar" title="Cerrar">&times;</button>`;
        alertaDiv.querySelector('.alerta-cerrar').addEventListener('click', () => alertaDiv.remove());
        alertasContainer.appendChild(alertaDiv);
    };
    productosBajoStock.forEach(p => crearAlertaHTML(`<strong>¡Bajo Stock!</strong> El producto "${p.nombre}" tiene solo ${p.stock} ${p.unidad}(s) restantes.`, 'stock'));
    productosProximosAVencer.forEach(p => crearAlertaHTML(`<strong>¡Próximo a Vencer!</strong> El producto "${p.nombre}" vence el ${new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}.`, 'vencimiento'));
  };

  const renderizarTabla = (productos) => {
    if (!productos || productos.length === 0) {
      tablaBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;">No se encontraron productos.</td></tr>`;
      return;
    }
    const htmlRows = productos.map(p => {
      const imagenSrc = p.imagen_url ? `app://${p.imagen_url.replace(/\\/g, "/")}` : '';
      const estadoClass = p.activo ? "estado-activo" : "estado-inactivo";
      const estadoTexto = p.activo ? "Activo" : "Inactivo";
      const departamento = p.familia?.departamento?.nombre || 'N/A';
      const familia = p.familia?.nombre || 'N/A';
      return `
        <tr>
          <td><img src="${imagenSrc}" alt="${p.nombre}" class="producto-imagen" onerror="this.style.display='none';"></td>
          <td>${p.nombre}</td>
          <td>${departamento}</td>
          <td>${familia}</td>
          <td>${p.codigo_barras || "N/A"}</td>
          <td>${p.stock} ${p.unidad}</td>
          <td>${(p.precioVenta || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
          <td style="text-align: center;"><span class="${estadoClass}">${estadoTexto}</span></td>
          <td class="acciones-btn">
            <button class="btn-toggle-active btn btn-sm" data-id="${p.id}" title="Activar/Desactivar">🔄</button>
            <button class="btn-edit btn btn-info btn-sm" data-id="${p.id}" title="Editar">✏️</button>
            <button class="btn-delete btn btn-danger btn-sm" data-id="${p.id}" title="Eliminar">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
    tablaBody.innerHTML = htmlRows;
  };

  const filtrarYRenderizar = () => {
    const query = searchInput.value.toLowerCase().trim();
    const productosFiltrados = query
      ? listaDeProductos.filter(p => p.nombre.toLowerCase().includes(query) || (p.codigo_barras && p.codigo_barras.toLowerCase().includes(query)))
      : listaDeProductos;
    renderizarTabla(productosFiltrados);
  };

  const cargarProductos = async () => {
    try {
      listaDeProductos = await window.electronAPI.invoke("get-productos");
      verificarYMostrarAlertas(listaDeProductos);
      filtrarYRenderizar();
    } catch (error) {
      console.error("Error al cargar productos:", error);
      showNotification("No se pudieron cargar los productos.", "error");
    }
  };

  // --- 4. EVENT LISTENERS ---
  btnNuevoProducto.addEventListener("click", () => {
    window.location.href = 'producto-form.html';
  });

  searchInput.addEventListener("input", filtrarYRenderizar);

  tablaBody.addEventListener("click", async (e) => {
    if (isProcessing) return;
    const button = e.target.closest("button");
    if (!button) return;
    const productoId = button.dataset.id;
    if (!productoId) return;

    if (button.classList.contains("btn-edit")) {
      window.location.href = `producto-form.html?id=${productoId}`;
    }

    if (button.classList.contains("btn-delete")) {
      if (confirm("¿Estás seguro de que quieres eliminar este producto?")) {
        isProcessing = true;
        button.disabled = true;
        try {
          const res = await window.electronAPI.invoke("eliminar-producto", productoId);
          if (res.success) {
            showNotification("Producto eliminado.", "success");
            await cargarProductos();
          } else {
            showNotification(`Error al eliminar: ${res.message}`, "error");
            button.disabled = false;
          }
        } finally {
          isProcessing = false;
        }
      }
    }

    if (button.classList.contains("btn-toggle-active")) {
      isProcessing = true;
      button.disabled = true;
      try {
        await window.electronAPI.invoke("toggle-producto-activo", productoId);
        await cargarProductos();
        showNotification("Estado del producto actualizado.", "success");
      } finally {
        isProcessing = false;
      }
    }
  });

  // --- 5. ARRANQUE ---
  cargarProductos();
});