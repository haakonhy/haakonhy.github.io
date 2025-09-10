async function loadComponent(url, elementId) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const text = await response.text();
    document.getElementById(elementId).innerHTML = text;
  } catch (error) {
    console.error(`Failed to load component ${url}:`, error);
    document.getElementById(
      elementId
    ).innerHTML = `<p>Error loading ${url}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadComponent("components/header.html", "header-container");
  loadComponent("components/footer.html", "footer-container");
});
