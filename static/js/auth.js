const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const token = localStorage.getItem("jwt");

  options.headers = {
    ...(options.headers || {}),
    Authorization: "Bearer " + token
  };

  return originalFetch(url, options);
};

