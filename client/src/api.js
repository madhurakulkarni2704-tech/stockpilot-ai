import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/invalid session anywhere sends the user back to sign in.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.startsWith("/auth/login") && !url.startsWith("/auth/register")) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  }
);

export function errMsg(err) {
  const d = err.response?.data;
  if (d?.details?.length && d.details[0].message) return d.details[0].message;
  if (d?.message) return d.message;
  if (err.code === "ERR_NETWORK") return "Cannot reach the server. Check that the API is running.";
  return err.message || "Something went wrong";
}

export default api;
