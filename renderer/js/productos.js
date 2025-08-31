// renderer/js/productos.js
// Optimizado: DocumentFragment, confirm modal no bloqueante, yields y anti doble click.

document.addEventListener("app-ready", () => {
  // --- 1) REFS ---
  const tablaBody = document.getElementById("productos-table-body");
  const btnNuevoProducto = document.getElementById("btn-nuevo-producto");
  const searchInput = document.getElementById("search-input");
  const alertasContainer = document.getElementById("alertas-container");
  const toast = document.getElementById("toast-notification");
  let toastTimer;

  // Confirm modal (inserto uno liviano para evitar window.confirm)
  const confirmOverlay = document.createElement("div");
  confirmOverlay.className = "confirm-overlay";
  confirmOverlay.innerHTML = `
    <div class="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h4 id="confirm-title">Confirmar eliminación</h4>
      <p id="confirm-msg">¿Estás seguro de eliminar este producto?</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-secundario" data-action="cancelar">Cancelar</button>
        <button type="button" class="btn btn-danger" data-action="aceptar">Eliminar</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmOverlay);

  // --- 2) ESTADO ---
  let listaDeProductos = [];

  // --- 3) HELPERS ---
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 150 }) : setTimeout(r, 0)));

  const showNotification = (message, type = "success") => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast";
    toast.classList.add(type, "visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
  };

  const confirmar = (mensaje = "¿Estás seguro?") =>
    new Promise((resolve) => {
      confirmOverlay.querySelector("#confirm-msg").textContent = mensaje;
      confirmOverlay.classList.add("visible");
      const onClick = (ev) => {
        const action = ev.target?.dataset?.action;
        if (!action) return;
        ev.stopPropagation();
        ev.preventDefault();
        confirmOverlay.classList.remove("visible");
        confirmOverlay.removeEventListener("click", onClick);
        resolve(action === "aceptar");
      };
      confirmOverlay.addEventListener("click", onClick);
    });

  const verificarYMostrarAlertas = (productos) => {
    if (!alertasContainer) return;
    alertasContainer.innerHTML = "";
    const LIMITE_STOCK_BAJO = 5;
    const DIAS_PARA_VENCIMIENTO = 7;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limiteVencimiento = new Date(hoy);
    limiteVencimiento.setDate(hoy.getDate() + DIAS_PARA_VENCIMIENTO);

    const productosBajoStock = productos.filter(p => p.activo && p.stock > 0 && p.stock < LIMITE_STOCK_BAJO);
    const productosProximosAVencer = productos.filter(p => {
      if (!p.activo || !p.fecha_vencimiento) return false;
      const f = new Date(p.fecha_vencimiento + "T00:00:00");
      return f >= hoy && f <= limiteVencimiento;
    });

    const addAlert = (mensaje, tipo) => {
      const div = document.createElement("div");
      div.className = `alerta ${tipo}`;
      div.innerHTML = `<span>${mensaje}</span><button class="alerta-cerrar" title="Cerrar">&times;</button>`;
      div.querySelector(".alerta-cerrar").addEventListener("click", () => div.remove());
      alertasContainer.appendChild(div);
    };

    productosBajoStock.forEach(p => addAlert(
      `<strong>¡Bajo Stock!</strong> "${p.nombre}" tiene ${p.stock} ${p.unidad}(s).`, "stock"
    ));
    productosProximosAVencer.forEach(p => addAlert(
      `<strong>¡Próximo a vencer!</strong> "${p.nombre}" vence el ${new Date(p.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR")}.`, "vencimiento"
    ));
  };

  const renderizarTabla = async (productos) => {
    if (!tablaBody) return;
    tablaBody.innerHTML = "";
    await nextFrame();

    if (!productos || productos.length === 0) {
      tablaBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;">No se encontraron productos.</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();

    productos.forEach((p) => {
      const tr = document.createElement("tr");
      const imagenSrc = p.imagen_url ? `app://${String(p.imagen_url).replace(/\\/g, "/")}` : "";
      const estadoClass = p.activo ? "estado-activo" : "estado-inactivo";
      const estadoTexto = p.activo ? "Activo" : "Inactivo";
      const departamento = p.familia?.departamento?.nombre || "N/A";
      const familia = p.familia?.nombre || "N/A";

      tr.innerHTML = `
        <td><img src="${imagenSrc}" alt="${p.nombre}" class="producto-imagen" onerror="this.style.display='none';"></td>
        <td>${p.nombre}</td>
        <td>${departamento}</td>
        <td>${familia}</td>
        <td>${p.codigo_barras || "N/A"}</td>
        <td>${p.stock} ${p.unidad}</td>
        <td>${(p.precioVenta || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
        <td style="text-align:center;"><span class="${estadoClass}">${estadoTexto}</span></td>
        <td class="acciones-btn">
          <button class="btn-toggle-active btn btn-sm" data-id="${p.id}" title="Activar/Desactivar">🔄</button>
          <button class="btn-edit btn btn-info btn-sm" data-id="${p.id}" title="Editar">✏️</button>
          <button class="btn-delete btn btn-danger btn-sm" data-id="${p.id}" title="Eliminar">🗑️</button>
        </td>
      `;
      frag.appendChild(tr);
    });

    tablaBody.appendChild(frag);
    await idle();
  };

  const filtrarYRenderizar = async () => {
    const q = (searchInput.value || "").toLowerCase().trim();
    const data = q
      ? listaDeProductos.filter(p =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q))
        )
      : listaDeProductos;
    await renderizarTabla(data);
  };

  const cargarProductos = async () => {
    try {
      tablaBody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando…</td></tr>';
      const data = await window.electronAPI.invoke("get-productos");
      listaDeProductos = Array.isArray(data) ? data : [];
      verificarYMostrarAlertas(listaDeProductos);
      await filtrarYRenderizar();
    } catch (e) {
      console.error("Error al cargar productos:", e);
      showNotification("No se pudieron cargar los productos.", "error");
      tablaBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color:red;">Error al cargar.</td></tr>';
    }
  };

  // --- 4) EVENTS ---
  btnNuevoProducto?.addEventListener("click", () => {
    window.location.href = "producto-form.html";
  }, { passive: true });

  searchInput?.addEventListener("input", () => {
    // no bloquear el hilo si vienen muchas teclas
    window.requestAnimationFrame(filtrarYRenderizar);
  });

  tablaBody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    // antirebote
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";

    try {
      if (btn.classList.contains("btn-edit")) {
        await nextFrame();
        window.location.href = `producto-form.html?id=${id}`;
        return;
      }

      if (btn.classList.contains("btn-delete")) {
        const ok = await confirmar("¿Eliminar este producto? Esta acción no se puede deshacer.");
        if (!ok) return;

        btn.disabled = true;
        const res = await window.electronAPI.invoke("eliminar-producto", id);
        if (res?.success) {
          showNotification("Producto eliminado.");
          setTimeout(() => { cargarProductos(); }, 0);
        } else {
          showNotification(res?.message || "No se pudo eliminar.", "error");
        }
      }

      if (btn.classList.contains("btn-toggle-active")) {
        btn.disabled = true;
        const res = await window.electronAPI.invoke("toggle-producto-activo", id);
        if (res?.success) {
          showNotification("Estado actualizado.");
          setTimeout(() => { cargarProductos(); }, 0);
        } else {
          btn.disabled = false;
          showNotification(res?.message || "No se pudo actualizar.", "error");
        }
      }
    } catch (err) {
      console.error(err);
      showNotification("Ocurrió un error al procesar la acción.", "error");
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
      await nextFrame();
    }
  });

  // --- 5) START ---
  cargarProductos();
});
