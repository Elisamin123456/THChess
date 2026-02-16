const isLocalDevHost =
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") &&
  window.location.port === "5173";

const pathParts = window.location.pathname.split("/").filter(Boolean);
const repoBase = pathParts.length > 0 ? `/${pathParts[0]}/` : "/";
const entryModule = isLocalDevHost ? "./main.ts" : `${repoBase}assets/app.js`;
import(/* @vite-ignore */ entryModule);
