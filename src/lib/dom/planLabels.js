// Floor-plan label pins (DOM), shown during the top-down intro.
// Returns an array of { x, z, el } the engine projects each frame.

export function createPlanLabels(planLayer, PLAN) {
  return PLAN.map((pl) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;transform:translate(-50%,-50%);text-align:center;transition:opacity .25s;';
    el.innerHTML =
      '<div style="width:9px;height:9px;border-radius:50%;border:1.5px solid #2b2620;margin:0 auto 8px;"></div>' +
      '<div class="r3i-plan-name" style="font-family:var(--font-sans),sans-serif;font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#2b2620;white-space:nowrap;"></div>';
    // textContent (not innerHTML) for imported names — can't inject markup
    el.querySelector('.r3i-plan-name').textContent = pl.name;
    planLayer.appendChild(el);
    return { x: pl.x, z: pl.z, el };
  });
}
