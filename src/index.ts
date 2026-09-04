import './styles/main.css';

function initDavispediaUI(): void {
  // General Davispedia progressive enhancements belong here. Cowlender is
  // compiled separately so its React bundle only loads on Special:Cowlender.
  const personalMenu = document.querySelector('.vector-user-links')
    || document.getElementById('p-personal');

  if (personalMenu) {
    // Reserved for future site-wide controls.
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDavispediaUI, { once: true });
} else {
  initDavispediaUI();
}
