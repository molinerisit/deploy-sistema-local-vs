// renderer/js/etiquetas.js
document.addEventListener("app-ready", () => {
  // --- Refs ---
  const mainTitle = document.getElementById("main-title");
  const configEtiquetas = document.getElementById("config-etiquetas");
  const configLista = document.getElementById("config-lista");
  const productList = document.getElementById("product-list");
  const searchInput = document.getElementById("search-input");
  const deptoFilter = document.getElementById("depto-filter");
  const familiaFilter = document.getElementById("familia-filter");
  const btnSelectAll = document.getElementById("select-all");
  const btnDeselectAll = document.getElementById("deselect-all");
  const btnGenerar = document.getElementById("btn-generar");
  const logoFileInput = document.getElementById("logoFile");
  const toast = document.getElementById("toast-notification");
  const logoSizeInput = document.getElementById("logoSize");
  const logoSizeValue = document.getElementById("logoSizeValue");

  // --- State ---
  let allProducts = [];
  let allDepartamentos = [];
  let MODO = "etiquetas";
  let toastTimer;

  // --- Utils ---
  const showToast = (msg, type = "success", ms = 3000) => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = "toast";
    toast.classList.add(type, "visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), ms);
  };

  const getBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });

  // --- Setup ---
  const setupPageForMode = () => {
    const params = new URLSearchParams(window.location.search);
    MODO = params.get("modo") || "etiquetas";
    if (MODO === "lista") {
      mainTitle.textContent = "Generar Lista de Precios";
      configEtiquetas.style.display = "none";
      configLista.style.display = "block";
    } else {
      mainTitle.textContent = "Generar Etiquetas de Góndola";
      configEtiquetas.style.display = "block";
      configLista.style.display = "none";
    }
  };

  const renderProducts = (products) => {
    productList.innerHTML = "";
    products.forEach((p) => {
      const item = document.createElement("div");
      item.className = "product-item";
      // ojo: backend con alias en minúscula
      const deptoId = p.familia?.departamento ? String(p.familia.departamento.id) : "";
      const familiaId = p.familia ? String(p.familia.id) : "";
      item.dataset.deptoId = deptoId;
      item.dataset.familiaId = familiaId;
      item.innerHTML = `
        <input type="checkbox" class="product-checkbox" value="${p.id}">
        <label>${p.nombre}</label>
      `;
      productList.appendChild(item);
    });
  };

  const filterProducts = () => {
    const q = (searchInput.value || "").toLowerCase();
    const d = deptoFilter.value;
    const f = familiaFilter.value;
    const items = productList.getElementsByClassName("product-item");
    for (const item of items) {
      const nombre = item.querySelector("label").textContent.toLowerCase();
      const matchesSearch = nombre.includes(q);
      const matchesDepto = d === "all" || item.dataset.deptoId === d;
      const matchesFamilia = f === "all" || item.dataset.familiaId === f;
      item.style.display = matchesSearch && matchesDepto && matchesFamilia ? "flex" : "none";
    }
  };

  const loadData = async () => {
    try {
      const { productos, departamentos } = await window.electronAPI.invoke("get-data-for-seleccion");
      allProducts = Array.isArray(productos) ? productos : [];
      allDepartamentos = Array.isArray(departamentos) ? departamentos : [];
      renderProducts(allProducts);

      // departamentos
      allDepartamentos.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.nombre;
        deptoFilter.appendChild(opt);
      });
    } catch (e) {
      console.error("get-data-for-seleccion", e);
      showToast("No se pudieron cargar productos/departamentos.", "error");
    }
  };

  // --- Events ---
  searchInput.addEventListener("input", filterProducts);

  deptoFilter.addEventListener("change", () => {
    const deptoId = deptoFilter.value;
    familiaFilter.innerHTML = '<option value="all">Todas las Familias</option>';
    if (deptoId === "all") {
      familiaFilter.disabled = true;
    } else {
      const d = allDepartamentos.find((x) => String(x.id) === String(deptoId));
      if (d?.familias?.length) {
        d.familias.forEach((fam) => {
          const opt = document.createElement("option");
          opt.value = fam.id;
          opt.textContent = fam.nombre;
          familiaFilter.appendChild(opt);
        });
      }
      familiaFilter.disabled = false;
    }
    filterProducts();
  });

  familiaFilter.addEventListener("change", filterProducts);

  btnSelectAll.addEventListener("click", () => {
    productList.querySelectorAll(".product-item").forEach((item) => {
      if (item.style.display !== "none") {
        item.querySelector(".product-checkbox").checked = true;
      }
    });
  });

  btnDeselectAll.addEventListener("click", () => {
    productList.querySelectorAll(".product-checkbox").forEach((cb) => (cb.checked = false));
  });

  if (logoSizeInput && logoSizeValue) {
    logoSizeInput.addEventListener("input", (e) => {
      logoSizeValue.textContent = e.target.value;
    });
  }

  btnGenerar.addEventListener("click", async () => {
    const ids = Array.from(document.querySelectorAll(".product-checkbox:checked")).map((cb) =>
      parseInt(cb.value, 10)
    );
    if (ids.length === 0) {
      showToast("Seleccioná al menos un producto.", "error");
      return;
    }

    let logoBase64 = null;
    if (logoFileInput?.files?.length) {
      try {
        logoBase64 = await getBase64(logoFileInput.files[0]);
      } catch {
        showToast("No se pudo leer el logo.", "error");
        return;
      }
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
      columnas: Array.from(
        document.querySelectorAll('#config-lista input[type="checkbox"]:checked')
      ).map((cb) => cb.value),
    };

    btnGenerar.disabled = true;
    const prev = btnGenerar.textContent;
    btnGenerar.textContent = "Generando...";

    try {
      const r = await window.electronAPI.invoke("generar-vista-impresion", {
        productoIds: ids,
        config,
      });
      if (r?.success === false) {
        showToast(r.message || "No se pudo generar la vista previa.", "error");
      } else {
        showToast("Vista previa generada.");
      }
    } catch (e) {
      console.error("generar-vista-impresion", e);
      showToast("Ocurrió un error al generar la vista previa.", "error");
    } finally {
      btnGenerar.disabled = false;
      btnGenerar.textContent = prev;
    }
  });

  // --- Init ---
  setupPageForMode();
  loadData();
});
