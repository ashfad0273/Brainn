/* Set the theme before first paint to avoid a flash. Loaded synchronously in
   <head>; kept external so the page needs no inline script (strict CSP).
   The two hexes are --background in each theme, which this script runs too
   early to read; check-conventions `theme-color-sync` keeps them equal. */
(function () {
  try {
    var t = localStorage.getItem("sl-theme") ||
            (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute("content", t === "dark" ? "#070709" : "#f7f7f7");
  } catch (e) {}
})();
