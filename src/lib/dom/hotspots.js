// Clickable material hotspots (DOM markers + info card). The engine projects
// each marker to screen space every frame and toggles the active card.
//
// Returns { hotspots, getActive, setActive } where each hotspot is the config
// entry augmented with `.el`.

export function createHotspots(hotspotLayer, infoEl, HOTSPOTS, onChange) {
  let active = null;

  const hotspots = HOTSPOTS.map((hs) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;width:20px;height:20px;border-radius:50%;border:1.5px solid #2b2620;background:rgba(233,227,216,.55);transform:translate(-50%,-50%);cursor:pointer;pointer-events:auto;transition:opacity .4s,transform .2s;display:flex;align-items:center;justify-content:center;animation:r3i-pulse 2.8s ease-out infinite;';
    const dot = document.createElement('div');
    dot.style.cssText = 'width:5px;height:5px;border-radius:50%;background:#2b2620;';
    el.appendChild(dot);
    // Keyboard + SR reachable: the marker is a real button.
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', hs.title);
    el.tabIndex = 0;
    el.addEventListener('mouseenter', () => { el.style.transform = 'translate(-50%,-50%) scale(1.25)'; });
    el.addEventListener('mouseleave', () => { el.style.transform = 'translate(-50%,-50%) scale(1)'; });
    const activate = () => {
      active = active === hs ? null : hs;
      if (!active) { infoEl.style.display = 'none'; }
      else {
        infoEl.innerHTML =
          '<div style="font-family:var(--font-sans),sans-serif;font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:rgba(43,38,32,.7);margin-bottom:6px;">Material</div>' +
          '<div class="r3i-info-title" style="font-family:var(--font-serif),serif;font-size:22px;color:#2b2620;line-height:1;margin-bottom:6px;"></div>' +
          '<div class="r3i-info-meta" style="font-family:var(--font-sans),sans-serif;font-size:11px;color:rgba(43,38,32,.66);letter-spacing:.02em;"></div>';
        // textContent (not innerHTML) for imported strings — can't inject markup
        infoEl.querySelector('.r3i-info-title').textContent = hs.title;
        infoEl.querySelector('.r3i-info-meta').textContent = hs.meta;
        infoEl.style.cssText +=
          ';display:block;background:rgba(243,239,231,.92);backdrop-filter:blur(8px);padding:16px 18px;border-radius:3px;box-shadow:0 14px 40px rgba(43,38,32,.16);border:1px solid rgba(43,38,32,.1);max-width:230px;';
      }
      if (onChange) onChange();
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    hotspotLayer.appendChild(el);
    hs.el = el;
    return hs;
  });

  return {
    hotspots,
    getActive: () => active,
    setActive: (v) => {
      active = v;
      if (!active) infoEl.style.display = 'none';
    },
  };
}
