/**
 * THALES OS — HTML Generator
 * Adheres strictly to Cidi Labs DesignPlus HTML formatting.
 */

export function generateHtmlForDay(dayData: any) {
  
  // Requirement: Cidi Labs DesignPlus HTML formatting.
  // Requirement: No inline style attributes for structural div/headers.
  
  let html = `<div class="dp-box">`;
  
  if (dayData.inClass) {
    html += `<h2 class="dp-header">In Class</h2>`;
    html += `<div>${dayData.inClass}</div>`;
  }
  
  if (dayData.atHome) {
    html += `<h2 class="dp-header">At Home</h2>`;
    if (dayData.atHomeUrl) {
      html += `<div><a href="${dayData.atHomeUrl}" target="_blank" rel="noopener">${dayData.atHome}</a></div>`;
    } else {
      html += `<div>${dayData.atHome}</div>`;
    }
  }

  if (dayData.resources && dayData.resources.length > 0) {
    html += `<h3>Resources</h3>`;
    html += `<ul>`;
    dayData.resources.forEach((res: any) => {
      html += `<li>${res.title}</li>`;
    });
    html += `</ul>`;
  }
  
  html += `</div>`;
  
  return html;
}
