import './styles/main.css';

function initDavispediaUI() {
  // Vector 2022 personal tools / user dropdown container
  const personalMenu = document.querySelector('.vector-user-links') || document.getElementById('p-personal');

  if (personalMenu) {
    // const userName = window.mw?.config?.get('wgUserName');
  }
}

// Ensure DOM is ready before mounting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDavispediaUI);
} else {
  initDavispediaUI();
}