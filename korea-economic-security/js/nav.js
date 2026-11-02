// Мобільне меню
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (btn && links) btn.addEventListener("click", () => links.classList.toggle("open"));
});
