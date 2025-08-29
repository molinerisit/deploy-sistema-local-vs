(function () {
  const BANNER_ID = "premium-banner";
  const CLOSE_ID = "close-premium-banner";
  const STATUS_EL_ID = "subscription-status-display";
  const DISMISS_KEY = "dismissedPremiumBanner";

  const banner = document.getElementById(BANNER_ID);
  const closeBtn = document.getElementById(CLOSE_ID);
  const statusEl = document.getElementById(STATUS_EL_ID);

  function shouldShowBanner(status, syncEnabled) {
    // Mostramos si: no hay sync, o no hay status, o estado NO activo
    if (!syncEnabled) return true;
    if (!status) return true;
    return status.status !== "active"; // 'warning', 'expired', 'disabled', 'error', etc.
  }

  function applyStatusToUI(status) {
    if (!statusEl) return;
    const baseClass = "status-display";
    statusEl.className = baseClass;
    statusEl.textContent = status?.message || "Sin información de suscripción.";
    if (!status) return;
    if (status.status === "active") statusEl.classList.add("active");
    else if (status.status === "warning") statusEl.classList.add("warning");
    else statusEl.classList.add("error");
  }

  async function refreshStatus() {
    try {
      const { success, status, message } = await window.electronAPI.invoke("get-subscription-status");
      // También obtenemos la config para saber si la sync está habilitada
      const cfg = await window.electronAPI.invoke("get-admin-config");
      applyStatusToUI(success ? status : null);

      // Banner (respetando dismiss manual)
      const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      if (!dismissed && shouldShowBanner(status, !!cfg?.sync_enabled)) {
        banner?.classList.remove("hidden");
      } else {
        banner?.classList.add("hidden");
      }
    } catch (err) {
      // Si algo falla, mostramos banner sólo si no fue descartado
      if (localStorage.getItem(DISMISS_KEY) !== "1") {
        banner?.classList.remove("hidden");
      }
    }
  }

  // Cerrar banner (persistente)
  closeBtn?.addEventListener("click", () => {
    banner?.classList.add("hidden");
    localStorage.setItem(DISMISS_KEY, "1");
  });

  // Primer refresco y luego cada 15 minutos
  document.addEventListener("app-ready", refreshStatus);
  setInterval(refreshStatus, 15 * 60 * 1000);
})();
