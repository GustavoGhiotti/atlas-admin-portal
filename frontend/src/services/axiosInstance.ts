import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "/api",
});

const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

function extractApiMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return "";
  }
  const payload = data as { mensagem?: string; detail?: string };
  return payload.mensagem || payload.detail || "";
}

function redirectToLogin(message: string) {
  localStorage.removeItem("token");
  localStorage.removeItem("auth_user");
  sessionStorage.setItem("auth_redirect_message", message);
  const loginPath = `${APP_BASE_PATH}/login`;
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  }
}

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const token = localStorage.getItem("token");
    const message = extractApiMessage(error?.response?.data) || "Sessao expirada. Faca login novamente.";

    if (status === 401 && token) {
      redirectToLogin(message);
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
