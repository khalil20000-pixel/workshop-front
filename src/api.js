import axios from "axios";

// In dev, Vite proxies "/api" -> backend (see vite.config.js).
// In production, set VITE_API_URL to your deployed backend, e.g.
//   https://your-backend.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Attach the JWT token (if any) to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Prevent the browser (and any CDN/proxy) from serving a stale cached
  // response for GETs. Without this, after an edit the app can reload the
  // *old* cached data, so the UI looks like it "didn't change". A unique
  // timestamp param makes every GET URL distinct, forcing a fresh read.
  if ((config.method || "get").toLowerCase() === "get") {
    config.params = { ...(config.params || {}), _t: Date.now() };
  }
  return config;
});

// On 401, drop the token so the app falls back to the login page
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(err);
  }
);

export default api;
