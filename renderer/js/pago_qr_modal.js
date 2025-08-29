// renderer/js/pago_qr_modal.js

document.addEventListener("DOMContentLoaded", () => {
  // --- REFERENCIAS AL DOM ---
  const amountEl = document.getElementById("qr-amount");
  const statusMsgEl = document.getElementById("status-message");
  const btnCancelar = document.getElementById("btn-cancelar-pago");

  const spinnerEl = document.getElementById("spinner");
  const successIconEl = document.getElementById("success-icon");
  const errorIconEl = document.getElementById("error-icon");

  // --- ESTADO ---
  let pollingInterval;
  let externalReference;

  const setUIState = (state) => {
    spinnerEl.classList.toggle("oculto", state !== "polling");
    successIconEl.classList.toggle("oculto", state !== "success");
    errorIconEl.classList.toggle("oculto", state !== "error");
  };

  const startPolling = () => {
    if (!externalReference) {
      statusMsgEl.textContent = "Error: Falta la referencia.";
      setUIState("error");
      return;
    }
    pollingInterval = setInterval(async () => {
      try {
        const result = await window.electronAPI.invoke(
          "check-mp-payment-status",
          { externalReference }
        );
        if (result.success) {
          statusMsgEl.textContent = `Estado: ${result.status}...`;
          if (result.status === "approved") handlePaymentSuccess();
          else if (
            result.status === "rejected" ||
            result.status === "cancelled"
          )
            handlePaymentFailure(`Pago ${result.status}.`);
        } else {
          handlePaymentFailure(result.message || "Error al consultar estado.");
        }
      } catch (error) {
        handlePaymentFailure("Error de comunicación con el sistema.");
      }
    }, 3000);
  };

  const handlePaymentSuccess = () => {
    clearInterval(pollingInterval);
    setUIState("success");
    statusMsgEl.textContent = "¡Pago Aprobado!";
    btnCancelar.disabled = true;
    window.electronAPI.send("payment-successful", externalReference);
    setTimeout(() => window.close(), 2000);
  };

  const handlePaymentFailure = (message) => {
    clearInterval(pollingInterval);
    setUIState("error");
    statusMsgEl.textContent = message;
    btnCancelar.textContent = "Cerrar";
  };

  // --- EVENT LISTENERS ---
  window.electronAPI.on("venta-data", (data) => {
    if (!data || typeof data.total !== "number" || !data.externalReference) {
      setUIState("error");
      statusMsgEl.textContent = "Error: Datos de la venta inválidos.";
      return;
    }

    externalReference = data.externalReference;
    amountEl.textContent = `$ ${data.total.toFixed(2)}`;
    statusMsgEl.textContent = "Esperando pago del cliente...";
    setUIState("polling");
    startPolling();
  });

  btnCancelar.addEventListener("click", () => {
    clearInterval(pollingInterval);
    window.electronAPI.send("payment-cancelled");
    window.close();
  });

  window.onbeforeunload = () => {
    clearInterval(pollingInterval);
  };
});
