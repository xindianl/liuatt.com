document.addEventListener('DOMContentLoaded', () => {
  const menuButton = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-nav-links]');

  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.getAttribute('data-copy');
      const statusId = button.getAttribute('aria-describedby');
      const status = statusId ? document.getElementById(statusId) : null;

      try {
        await navigator.clipboard.writeText(value);
        if (status) status.textContent = '已复制';
      } catch {
        if (status) status.textContent = `请手动复制：${value}`;
      }
    });
  });
});

