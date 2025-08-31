// renderer/js/etiquetas.js
(() => {
  "use strict";

  let __INIT_DONE__ = false;
  const boot = () => {
    if (__INIT_DONE__) return;
    __INIT_DONE__ = true;

    // --- Refs ---
    const mainTitle       = document.getElementById("main-title");
    const configEtiquetas = document.getElementById("config-etiquetas");
    const configLista     = document.getElementById("config-lista");
    const productList     = document.getElementById("product-list");
    const searchInput     = document.getElementById("search-input");
    const deptoFilter     = document.getElementById("depto-filter");
    const familiaFilter   = document.getElementById("familia-filter");
    const btnSelectAll    = document.getElementById("select-all");
    const btnDeselectAll  = document.getElementById("deselect-all");
    const btnGenerar      = document.getElementById("btn-generar");
    const logoFileInput   = document.getElementById("logoFile");
    const toast           = document.getElementById("toast-notification");
    const logoSizeInput   = document.getElementById("logoSize");
    const logoSizeValue   = document.getElementById("logoSizeValue");

    // --- State ---
    let allProducts = [];
    let allDepartamentos = [];
    let MODO = "etiquetas";
    let toastTimer, filterTimer;

    // --- Utils ---
    const showToast = (msg, type = "success", ms = 3000) => {
      if (!toast) return;
      clearTimeout(toastTimer);
      toast.textContent = msg;
      toast.className = "toast";
      toast.classList.add(type, "visible");
      toastTimer = setTimeout(() => toast.classList.remove("visible"), ms);
    };

    const getBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

    const debounce = (fn, delay = 150) => (...args) => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => fn(...args), delay);
    };

    // --- Setup ---
    const setupPageForMode = () => {
      const params = new URLSearchParams(window.location.search);
      MODO = params.get("modo") || "etiquetas";
      if (MODO === "lista") {
        mainTitle && (mainTitle.textContent = "Generar Lista de Precios");
        configEtiquetas && (configEtiquetas.style.display = "none");
        configLista && (configLista.style.display = "block");
      } else {
        mainTitle && (mainTitle.textContent = "Generar Etiquetas de Góndola");
        configEtiquetas && (configEtiquetas.style.display = "block");
        configLista && (configLista.style.display = "none");
      }
    };

    const renderProducts = (products) => {
      productList.innerHTML = "";
      if (!Array.isArray(products) || products.length === 0) {
        const empty = document.createElement("div");
        empty.className = "product-empty";
        empty.style.padding = "8px 12px";
        empty.style.color = "#666";
        empty.textContent = "Sin productos para mostrar.";
        productList.appendChild(empty);
        return;
      }
      const frag = document.createDocumentFragment();
      products.forEach((p) => {
        const item = document.createElement("label");
        item.className = "product-item";
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = "8px";
        item.style.padding = "8px 12px";
        item.style.borderBottom = "1px solid #eee";

        const deptoId   = p.familia?.departamento ? String(p.familia.departamento.id) : "";
        const familiaId = p.familia ? String(p.familia.id) : "";

        item.dataset.deptoId   = deptoId;
        item.dataset.familiaId = familiaId;
        item.title = p.nombre || "";

        const cb = document.createElement("input");
        cb.type  = "checkbox";
        cb.className = "product-checkbox";
        // IMPORTANTE: no casteamos a número aquí (dejamos el valor tal cual)
        cb.value = p.id != null ? String(p.id) : "";

        const name = document.createElement("span");
        name.textContent = p.nombre || "";

        item.appendChild(cb);
        item.appendChild(name);
        frag.appendChild(item);
      });
      productList.appendChild(frag);
    };

    const filterProducts = () => {
      const q = (searchInput?.value || "").toLowerCase();
      const d = deptoFilter?.value || "all";
      const f = familiaFilter?.value || "all";

      const items = productList.getElementsByClassName("product-item");
      let visible = 0;
      for (const item of items) {
        const nameEl = item.querySelector("span");
        const nombre = (nameEl?.textContent || "").toLowerCase();
        const matchesSearch   = !q || nombre.includes(q);
        const matchesDepto    = d === "all" || item.dataset.deptoId === d;
        const matchesFamilia  = f === "all" || item.dataset.familiaId === f;
        const show = matchesSearch && matchesDepto && matchesFamilia;
        item.style.display = show ? "flex" : "none";
        if (show) visible++;
      }

      const empty = productList.querySelector(".product-empty");
      if (visible === 0) {
        if (!empty) {
          const e = document.createElement("div");
          e.className = "product-empty";
          e.style.padding = "8px 12px";
          e.style.color = "#666";
          e.textContent = "No hay coincidencias con los filtros.";
          productList.appendChild(e);
        }
      } else if (empty) {
        empty.remove();
      }
    };

    const loadData = async () => {
      try {
        const { productos, departamentos } = await window.electronAPI.invoke("get-data-for-seleccion");
        allProducts = Array.isArray(productos) ? productos : [];
        allDepartamentos = Array.isArray(departamentos) ? departamentos : [];
        renderProducts(allProducts);

        // Departamentos
        if (deptoFilter) {
          for (const d of allDepartamentos) {
            const opt = document.createElement("option");
            opt.value = d.id;
            opt.textContent = d.nombre;
            deptoFilter.appendChild(opt);
          }
        }

        filterProducts();
      } catch (e) {
        console.error("[etiquetas] get-data-for-seleccion error:", e);
        showToast("No se pudieron cargar productos/departamentos.", "error");
        renderProducts([]);
      }
    };

    // --- Events ---
    searchInput && searchInput.addEventListener("input", debounce(filterProducts));
    searchInput && searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });

    if (deptoFilter && familiaFilter) {
      deptoFilter.addEventListener("change", () => {
        const deptoId = deptoFilter.value;
        familiaFilter.innerHTML = '<option value="all">Todas las Familias</option>';

        if (deptoId === "all") {
          familiaFilter.disabled = true;
        } else {
          const d = allDepartamentos.find((x) => String(x.id) === String(deptoId));
          if (d?.familias?.length) {
            for (const fam of d.familias) {
              const opt = document.createElement("option");
              opt.value = fam.id;
              opt.textContent = fam.nombre;
              familiaFilter.appendChild(opt);
            }
          }
          familiaFilter.disabled = false;
        }
        filterProducts();
      });

      familiaFilter.addEventListener("change", filterProducts);
    }

    btnSelectAll && btnSelectAll.addEventListener("click", () => {
      productList.querySelectorAll(".product-item").forEach((item) => {
        if (item.style.display !== "none") {
          const cb = item.querySelector(".product-checkbox");
          if (cb) cb.checked = true;
        }
      });
    });

    btnDeselectAll && btnDeselectAll.addEventListener("click", () => {
      productList.querySelectorAll(".product-checkbox").forEach((cb) => (cb.checked = false));
    });

    if (logoSizeInput && logoSizeValue) {
      logoSizeInput.addEventListener("input", (e) => {
        logoSizeValue.textContent = e.target.value;
      });
    }

    btnGenerar && btnGenerar.addEventListener("click", async () => {
      // Enviar IDs TAL CUAL (sin parseInt)
      const idsRaw = Array.from(document.querySelectorAll(".product-checkbox:checked"))
        .map((cb) => cb.value)
        .filter((v) => v != null && String(v).trim() !== "");

      console.log("[etiquetas] IDs seleccionados:", idsRaw);

      if (idsRaw.length === 0) {
        showToast("Seleccioná al menos un producto.", "error");
        return;
      }

      let logoBase64 = null;
      if (logoFileInput?.files?.length) {
        try { logoBase64 = await getBase64(logoFileInput.files[0]); }
        catch { showToast("No se pudo leer el logo.", "error"); return; }
      }

      const config = {
        modo: MODO,
        // etiquetas
        ancho: parseFloat(document.getElementById("ancho")?.value || "5"),
        alto: parseFloat(document.getElementById("alto")?.value || "3"),
        colorBorde: document.getElementById("colorBorde")?.value || "#000000",
        colorFondo: document.getElementById("colorFondo")?.value || "#ffffff",
        logoBase64,
        logoSize: parseInt(document.getElementById("logoSize")?.value || "30", 10),
        // lista
        listaTitulo: document.getElementById("listaTitulo")?.value || "Lista de Precios",
        columnas: Array.from(document.querySelectorAll('#config-lista input[type="checkbox"]:checked')).map((cb) => cb.value),
      };

      btnGenerar.disabled = true;
      const prev = btnGenerar.textContent;
      btnGenerar.textContent = "Generando...";

      try {
        const r = await window.electronAPI.invoke("generar-vista-impresion", {
          productoIds: idsRaw,
          config,
        });
        if (r?.success === false) {
          showToast(r.message || "No se pudo generar la vista previa.", "error");
        } else {
          showToast("Vista previa generada.");
        }
      } catch (e) {
        console.error("[etiquetas] generar-vista-impresion error:", e);
        showToast("Ocurrió un error al generar la vista previa.", "error");
      } finally {
        btnGenerar.disabled = false;
        btnGenerar.textContent = prev;
      }
    });

    // --- Init ---
    setupPageForMode();
    loadData();
  };

  document.addEventListener("app-ready", boot, { once: true });
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => { if (!__INIT_DONE__) boot(); }, 1000);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => { if (!__INIT_DONE__) boot(); }, 1000);
    });
  }
})();
