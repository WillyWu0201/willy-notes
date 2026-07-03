// Shared top navigation. Any page with <div id="site-nav"></div> that loads
// this script gets the nav injected, styled via the site's CSS custom properties.
(function () {
  var items = [
    { href: "/", label: "首頁" },
    { href: "/blog/", label: "部落格" },
    { href: "/wwdc26/", label: "WWDC26" },
  ];
  var path = location.pathname;
  function active(href) {
    if (href === "/") return path === "/" || path === "/index.html";
    return path.indexOf(href) === 0;
  }
  var css =
    '#site-nav{position:sticky;top:0;z-index:40;backdrop-filter:saturate(180%) blur(12px);' +
    '-webkit-backdrop-filter:saturate(180%) blur(12px);' +
    'background:color-mix(in srgb,var(--bg) 86%,transparent);border-bottom:1px solid var(--line)}' +
    '#site-nav .snav{max-width:880px;margin:0 auto;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 20px}' +
    '#site-nav .brand{font-family:var(--mono,ui-monospace,monospace);font-size:13px;font-weight:700;' +
    'letter-spacing:-.01em;color:var(--ink);text-decoration:none;margin-right:auto;white-space:nowrap}' +
    '#site-nav a.tab{font-size:13.5px;color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:999px;white-space:nowrap}' +
    '#site-nav a.tab:hover{color:var(--ink)}' +
    '#site-nav a.tab[aria-current="page"]{color:var(--ink);background:var(--accent-soft,rgba(127,127,127,.14))}';
  var tabs = items
    .map(function (it) {
      return '<a class="tab" href="' + it.href + '"' +
        (active(it.href) ? ' aria-current="page"' : "") + ">" + it.label + "</a>";
    })
    .join("");
  var mount = document.getElementById("site-nav");
  if (!mount) return;
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  mount.innerHTML = '<div class="snav"><a class="brand" href="/">willy-notes</a>' + tabs + "</div>";
  // Expose the nav's height so a page with its own sticky bar can offset below it.
  document.documentElement.style.setProperty("--nav-h", (mount.offsetHeight || 54) + "px");
})();
