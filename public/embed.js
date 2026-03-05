/**
 * Skill Forge — Embed Widget
 * Drop this script into any webpage to embed the Skill Forge generator.
 * 
 * Usage:
 *   <div id="skill-forge"></div>
 *   <script src="https://your-domain.com/embed.js" data-target="skill-forge"></script>
 * 
 * Or with custom options:
 *   <script src="https://your-domain.com/embed.js" 
 *     data-target="skill-forge"
 *     data-height="800"
 *     data-theme="dark">
 *   </script>
 */
(function() {
  const script = document.currentScript;
  const targetId = script.getAttribute('data-target') || 'skill-forge';
  const height = script.getAttribute('data-height') || '900';
  const baseUrl = script.src.replace(/\/embed\.js.*$/, '');

  const target = document.getElementById(targetId);
  if (!target) {
    console.error(`[Skill Forge] Target element #${targetId} not found`);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.src = `${baseUrl}?embed=1`;
  iframe.style.cssText = `
    width: 100%;
    height: ${height}px;
    border: none;
    border-radius: 12px;
    background: #0a0a0f;
  `;
  iframe.setAttribute('title', 'Skill Forge');
  iframe.setAttribute('loading', 'lazy');

  target.appendChild(iframe);
})();
