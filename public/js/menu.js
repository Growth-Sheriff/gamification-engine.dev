/**
 * Gamification Engine - Menu JS
 * Sidebar menu functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  const menuToggle = document.querySelector('.layout-menu-toggle');
  const layoutMenu = document.querySelector('.layout-menu');

  if (menuToggle && layoutMenu) {
    menuToggle.addEventListener('click', function(e) {
      e.preventDefault();
      layoutMenu.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!layoutMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        layoutMenu.classList.remove('open');
      }
    });
  }

  // Active menu item highlight
  const currentPath = window.location.pathname;
  const menuLinks = document.querySelectorAll('.menu-link');

  menuLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      link.closest('.menu-item').classList.add('active');
    }
  });

  // Dropdown functionality
  const dropdownToggles = document.querySelectorAll('[data-bs-toggle="dropdown"]');

  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      const dropdown = this.nextElementSibling;

      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        if (menu !== dropdown) {
          menu.classList.remove('show');
        }
      });

      dropdown.classList.toggle('show');
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });
});

