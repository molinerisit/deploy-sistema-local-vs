// renderer/js/proveedores.js (VERSIÓN FINAL CON TOASTS)

document.addEventListener('app-ready', () => { // Cambiado a app-ready por consistencia
    // --- 1. REFERENCIAS ---
    const tablaBody = document.getElementById('proveedores-table-body');
    const btnNuevoProveedor = document.getElementById('btn-nuevo-proveedor');
    
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

    const cargarProveedores = async () => {
        if (!tablaBody) return;
        tablaBody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';
        
        try {
            const listaDeProveedores = await window.electronAPI.invoke('get-proveedores');
            
            if (!listaDeProveedores || listaDeProveedores.length === 0) {
                tablaBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay proveedores registrados.</td></tr>';
                return;
            }

            const filasHtml = listaDeProveedores.map(p => {
                const tipoTexto = {
                    producto: 'Mercadería', insumos: 'Insumos', ambos: 'Ambos'
                }[p.tipo] || 'No especificado';
                
                const proveedorId = p.id; 

                return `
                    <tr>
                        <td>${p.nombreEmpresa}</td>
                        <td>${p.nombreRepartidor || 'N/A'}</td>
                        <td>${p.telefono || 'N/A'}</td>
                        <td>${p.diasReparto || 'N/A'}</td>
                        <td>${p.limitePedido || 'N/A'}</td>
                        <td>${tipoTexto}</td>
                        <td class="acciones-btn">
                            <button class="btn-edit btn btn-info" data-id="${proveedorId}" title="Editar">✏️</button>
                            <button class="btn-delete btn btn-danger" data-id="${proveedorId}" title="Eliminar">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tablaBody.innerHTML = filasHtml;

        } catch (error) {
            console.error("Error al cargar proveedores:", error);
            tablaBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:red;">Error al cargar proveedores.</td></tr>';
            showNotification("Error al cargar proveedores.", "error"); // Muestra el toast en error de carga
        }
    };

    // --- 3. EVENT LISTENERS ---
    if (btnNuevoProveedor) {
        btnNuevoProveedor.addEventListener('click', () => {
            window.location.href = 'proveedor-form.html';
        });
    }

    if (tablaBody) {
        tablaBody.addEventListener('click', async (event) => {
            const target = event.target.closest("button");
            if (!target) return;
            
            const proveedorId = target.dataset.id;
            
            if (!proveedorId || proveedorId === 'undefined' || proveedorId === 'null') {
                showNotification("Error: El ID del proveedor no es válido. Refresque la página.", "error");
                return;
            }

            if (target.classList.contains('btn-edit')) {
                window.location.href = `proveedor-form.html?id=${proveedorId}`;
            }

            if (target.classList.contains('btn-delete')) {
                if (confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
                    target.disabled = true;
                    try {
                        const result = await window.electronAPI.invoke('eliminar-proveedor', proveedorId);
                        if (result.success) {
                            showNotification("Proveedor eliminado con éxito.");
                            await cargarProveedores();
                        } else {
                            showNotification(result.message, "error");
                        }
                    } catch (error) {
                        showNotification("Ocurrió un error crítico al eliminar.", "error");
                    } finally {
                        target.disabled = false;
                    }
                }
            }
        });
    }
    
    // --- ARRANQUE ---
    cargarProveedores();
});