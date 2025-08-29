// renderer/js/navbar-loader.js
// Carga el sidebar, aplica permisos, inyecta el botón toggle (con persistencia) y dispara app-ready.

let __NAVBAR_INIT_DONE__ = false;
const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

document.addEventListener('DOMContentLoaded', async () => {
  if (__NAVBAR_INIT_DONE__) return;
  __NAVBAR_INIT_DONE__ = true;

  try {
    // 1) Inyectar el HTML del sidebar
    await cargarSidebarHTML();

    // 2) Traer sesión + config
    const [user, config] = await Promise.all([
      window.electronAPI.invoke('get-user-session'),
      window.electronAPI.invoke('get-admin-config'),
    ]);
    if (!user || !user.id) throw new Error('Sesión inválida.');

    // 3) Guardar sesión global
    window.APP_SESSION = { user, config: config || {} };

    // 4) Inicializar UI (texto, permisos, activo, logo, logout)
    inicializarSidebarUI(window.APP_SESSION);

    // 5) Inyectar y configurar el botón de toggle (una sola vez)
    inicializarSidebarToggle();

  } catch (err) {
    console.error('[NavbarLoader] Error inicializando:', err);
    const ph = document.getElementById('sidebar-placeholder');
    if (ph) ph.innerHTML = '<p style="color:red;padding:1rem;">Error al cargar el menú / sesión.</p>';
  } finally {
    // 6) Notificar al resto de la app
    document.dispatchEvent(new CustomEvent('app-ready'));
  }
});

async function cargarSidebarHTML() {
  const placeholder = document.getElementById('sidebar-placeholder');
  if (!placeholder) {
    console.warn('[NavbarLoader] No existe #sidebar-placeholder en este HTML.');
    return;
  }
  try {
    const res = await fetch('_sidebar.html', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    placeholder.innerHTML = await res.text();
  } catch (e) {
    console.error('[NavbarLoader] Error cargando _sidebar.html:', e);
    placeholder.innerHTML = '<p style="color:red;">Error al cargar menú.</p>';
  }
}

function inicializarSidebarUI({ user, config }) {
  // Marcar link activo
  const currentPage = window.location.pathname.split('/').pop();
  const activeLink = document.querySelector(`nav li a[href="${currentPage}"]`);
  if (activeLink) {
    activeLink.setAttribute('aria-current', 'page');
    activeLink.closest('li')?.classList.add('active');
  }

  // Refs
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarUserRole = document.getElementById('sidebar-user-role');
  const sidebarLogo = document.getElementById('sidebar-logo');
  const sidebarBusinessName = document.getElementById('sidebar-business-name');
  const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
  const sidebarAdminBtn = document.getElementById('sidebar-admin-btn');

  // Datos de usuario
  if (sidebarUsername) sidebarUsername.textContent = user.nombre || 'Usuario';
  if (sidebarUserRole) sidebarUserRole.textContent = user.rol || '';
  if (sidebarAdminBtn && user.rol !== 'administrador') sidebarAdminBtn.style.display = 'none';

  // Permisos
  let userPermissions = [];
  if (Array.isArray(user.permisos)) {
    userPermissions = user.permisos;
  } else if (typeof user.permisos === 'string' && user.permisos.trim()) {
    try { userPermissions = JSON.parse(user.permisos); } catch {}
  }

  document.querySelectorAll('a[data-module]').forEach((link) => {
    const moduleName = link.dataset.module;
    const li = link.closest('li');
    let visible = true;

    if (user.rol === 'cajero') {
      visible = userPermissions.includes(moduleName);
    }
    if (moduleName === 'facturacion' && (!config || config.facturacion_activa === false)) {
      visible = false;
    }
    if (li) li.style.display = visible ? '' : 'none';
  });

  // Datos del negocio
  if (sidebarBusinessName) sidebarBusinessName.textContent = (config && config.nombre_negocio) || 'Mi Negocio';
  if (sidebarLogo && config && config.logo_url) {
    const logoPath = String(config.logo_url).replace(/\\/g, '/');
    sidebarLogo.src = `app://${logoPath}?v=${Date.now()}`;
    sidebarLogo.style.display = 'block';
  }

  // Logout
  sidebarLogoutBtn?.addEventListener('click', () => window.electronAPI.send('logout'));
}

function inicializarSidebarToggle() {
  const container = document.querySelector('.container');
  if (!container) return;

  // Evitar duplicados: si ya existe, no crear otro
  let toggleBtn = document.getElementById('toggle-sidebar-btn');
  let toggleIcon;

  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-sidebar-btn';
    toggleBtn.className = 'toggle-sidebar';
    toggleBtn.type = 'button';

    toggleIcon = document.createElement('span');
    toggleIcon.id = 'toggle-icon';
    toggleBtn.appendChild(toggleIcon);

    // Insertar el botón justo después del <aside> (sidebar)
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.parentElement) {
      sidebar.parentElement.insertBefore(toggleBtn, sidebar.nextSibling);
    } else {
      // fallback: al final del container
      container.appendChild(toggleBtn);
    }
  } else {
    toggleIcon = document.getElementById('toggle-icon') || toggleBtn.querySelector('span') || document.createElement('span');
    if (!toggleIcon.id) toggleIcon.id = 'toggle-icon';
  }

  // Estado inicial (persistido)
  const collapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  container.classList.toggle('sidebar-collapsed', collapsed);
  toggleIcon.textContent = collapsed ? '▶' : '◀';

  // Click
  toggleBtn.addEventListener('click', () => {
    container.classList.toggle('sidebar-collapsed');
    const isCollapsed = container.classList.contains('sidebar-collapsed');
    toggleIcon.textContent = isCollapsed ? '▶' : '◀';
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? '1' : '0');
  }, { once: false });
}
