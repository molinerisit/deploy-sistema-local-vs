// renderer/preload.js (VERSIÓN FINAL CON TODOS LOS CANALES)
const { contextBridge, ipcRenderer } = require("electron");

const validInvokeChannels = [
  // Sesión y Setup
  "login-attempt",
  "get-user-session",
  "submit-setup",
  // Administración y Configuración
  "get-admin-config",
  "get-all-users",
  "get-user-by-id",
  "save-user",
  "delete-user",
  "get-app-modules",
  "save-facturacion-status",
  "save-mp-config",
  "save-balanza-config",
  "get-mp-pos-list", // ✅ CANAL PARA LISTAR CAJAS
  "save-general-config",
  "save-business-info",
  "save-hardware-config",
  "test-print",
  "get-available-ports",
  "save-afip-config",
  "save-arqueo-config",
  // Empleados y Gastos
  "get-empleados",
  "save-empleado",
  "delete-empleado",
  "get-gastos-fijos",
  "save-gasto-fijo",
  "imprimir-comprobante-mp",
  "delete-gasto-fijo",
  // Caja y Arqueo
  "busqueda-inteligente",
  "create-mp-order",
  "registrar-venta",
  "registrar-venta-y-facturar",
  "imprimir-ticket",
  "get-estado-caja",
  "show-toast", // para toasts iniciados desde main
  "save-sync-config",
  "force-sync-now",
  "abrir-caja",
  "cerrar-caja",
  "get-resumen-cierre",
  "get-all-cierres-caja",
  // Productos y sus Clasificaciones
  "get-productos",
  "get-producto-by-id",
  "guardar-producto",
  "eliminar-producto",
  "toggle-producto-activo",
  "get-clasificaciones",
  "guardar-departamento",
  "guardar-familia",
  // Proveedores
  "get-proveedores",
  "get-proveedor-by-id",
  "guardar-proveedor",
  "eliminar-proveedor",
  // Insumos y sus Clasificaciones
  "get-insumos",
  "get-insumo-by-id",
  "guardar-insumo",
  "eliminar-insumo",
  "get-insumo-clasificaciones",
  "guardar-insumo-departamento",
  "guardar-insumo-familia",
  // Clientes
  "get-clientes",
  "get-cliente-by-id",
  "guardar-cliente",
  "eliminar-cliente",
  "get-cliente-by-dni",
  // Compras
  "get-productos-insumos",
  "registrar-compra-insumos",
  "registrar-compra-producto",
  // Reportes y Estadísticas
  "get-dashboard-stats",
  "get-ventas",
  "get-ventas-con-factura",
  "check-mp-payment-status",
  "cobrarmppos",
  "facturar-venta",
  "get-rentabilidad-report",
  "export-report-as-pdf",
  // Etiquetas
  "get-data-for-seleccion",
  "generar-vista-impresion",
  "get-subscription-status",
  "run-manual-sync",

  // Cuentas Corrientes
  "get-clientes-con-deuda",
  "get-proveedores-con-deuda",
  "registrar-pago-cliente",
  "registrar-abono-proveedor",
  "get-mp-transactions",

  // 🔹 Balanza / Kretz
  "scale-upsert-plu" // <-- agregado para sincronizar PLU desde producto-form
];

const validSendChannels = [
  "logout",
  "relaunch-app",
  "open-qr-modal",
  "payment-successful",
  "payment-cancelled",
  "setup-complete",
];
const validOnChannels = [
  "mp-payment-approved",
  "mp-payment-cancelled",
  "venta-data",
  "show-toast",
  "block-message",
];

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel, data) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    console.error(
      `[Preload Error] Llamada a 'invoke' bloqueada. Canal no válido: '${channel}'`
    );
    return Promise.reject(new Error(`Canal IPC no válido: ${channel}`));
  },
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(
        `[Preload Error] Llamada a 'send' bloqueada. Canal no válido: '${channel}'`
      );
    }
  },
  on: (channel, func) => {
    if (validOnChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      console.error(
        `[Preload Error] Llamada a 'on' bloqueada. Canal no válido: '${channel}'`
      );
    }
  },
  onBlockMessage: (callback) =>
    ipcRenderer.on("block-message", (_event, value) => callback(value)),
});
