// renderer/js/sidebar-toggle.js (VERSIÓN FINAL CON PERSISTENCIA)

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".container");
  const toggleBtn = document.getElementById("toggle-sidebar-btn");
  const toggleIcon = document.getElementById("toggle-icon");
  const KEY = 'sidebarCollapsed';

  if (!container || !toggleBtn || !toggleIcon) return;

  // Estado inicial desde localStorage
  const collapsed = localStorage.getItem(KEY) === '1';
  container.classList.toggle("sidebar-collapsed", collapsed);
  toggleIcon.textContent = collapsed ? "▶" : "◀";

  toggleBtn.addEventListener("click", () => {
    container.classList.toggle("sidebar-collapsed");
    const isCollapsed = container.classList.contains("sidebar-collapsed");
    toggleIcon.textContent = isCollapsed ? "▶" : "◀";
    localStorage.setItem(KEY, isCollapsed ? '1' : '0');
  });
});
