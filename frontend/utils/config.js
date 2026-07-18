// frontend/utils/config.js
(function () {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isFile = protocol === "file:";
  const isStaticDevServer = ["3000", "3100", "5500"].includes(port);
  const localApiHost = isLocalhost ? hostname : "localhost";

  const API_URL = isFile || isStaticDevServer
    ? `http://${localApiHost}:5000`
    : window.location.origin;

  window.appConfig = {
    API_BASE_URL: `${API_URL}/api`,
    SOCKET_SERVER_URL: API_URL,
  };
})();
