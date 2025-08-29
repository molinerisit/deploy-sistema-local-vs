// renderer/js/insumos.js (VERSIÓN FINAL CON NOTIFICACIONES NO BLOQUEANTES)
document.addEventListener('app-ready', () => {
    // --- 1. REFERENCIAS ---
    const tablaBody = document.getElementById('insumos-table-body');
    const btnNuevoInsumo = document.getElementById('btn-nuevo-insumo');
    const searchInput = document.getElementById('search-input');
    
    // Referencia al elemento de notificación (toast)
    const toast = document.getElementById('toast-notification');
    let toastTimer; // Variable para controlar el temporizador

    // --- 2. FUNCIONES ---

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

    const formatCurrency = (n) => (n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

    const renderizarTabla = (insumos) => {
        if (!insumos || insumos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="7" class="text-center">No se encontraron insumos.</td></tr>`;
            return;
        }
        tablaBody.innerHTML = insumos.map(insumo => `
            <tr>
                <td>${insumo.nombre}</td>
                <td>${insumo.departamentoNombre || 'N/A'}</td>
                <td>${insumo.familiaNombre || 'N/A'}</td>
                <td>${insumo.stock}</td>
                <td>${insumo.unidad || ""}</td>
                <td>${formatCurrency(insumo.ultimoPrecioCompra)}</td>
                <td class="acciones-btn">
                    <button class="btn-edit btn btn-info" data-id="${insumo.id}" title="Editar">✏️</button>
                    <button class="btn-delete btn btn-danger" data-id="${insumo.id}" title="Eliminar">🗑️</button>
                </td>
            </tr>`).join("");
    };

    const cargarInsumos = async (filtro = '') => {
        try {
            const insumos = await window.electronAPI.invoke("get-insumos", filtro);
            renderizarTabla(insumos);
        } catch (error) { 
            showNotification("No se pudieron cargar los insumos.", "error"); 
            console.error("Error al cargar insumos:", error);
        }
    };

    // --- 3. EVENT LISTENERS ---
    btnNuevoInsumo.addEventListener('click', () => {
        window.location.href = 'insumo-form.html';
    });
    
    searchInput.addEventListener('input', () => cargarInsumos(searchInput.value));

    tablaBody.addEventListener('click', async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        
        const id = btn.dataset.id;
        if (!id || id === 'null' || id === 'undefined') return;

        if (btn.classList.contains("btn-edit")) {
            window.location.href = `insumo-form.html?id=${id}`;
        }

        if (btn.classList.contains("btn-delete")) {
            // Nota: confirm() sigue siendo bloqueante, pero es para una acción explícita del usuario.
            // Es aceptable, pero en el futuro podría reemplazarse con un modal de confirmación personalizado.
            if (confirm("¿Estás seguro de que quieres eliminar este insumo?")) {
                btn.disabled = true;
                const res = await window.electronAPI.invoke("eliminar-insumo", id);
                if (res.success) {
                    showNotification("Insumo eliminado con éxito.");
                    await cargarInsumos(searchInput.value); // Recarga la tabla
                } else {
                    showNotification(`Error al eliminar: ${res.message}`, "error");
                }
                btn.disabled = false;
            }
        }
    });

    // --- ARRANQUE ---
    cargarInsumos();
});