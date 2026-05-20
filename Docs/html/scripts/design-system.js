// Pattern tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add('active');
  });
});

// Ramp step tooltip on hover
document.querySelectorAll('.ramp-step').forEach(step => {
  const hex = step.getAttribute('title');
  if (!hex) return;
  step.addEventListener('mouseenter', () => {
    step.setAttribute('data-orig-title', step.title);
  });
});
