import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import axiosInstance from "@/services/axiosInstance";
import { obterSessao } from "@/services/atlasApi";

export type Usuario = {
  nm_login: string;
  nm_colaborador: string;
  nu_cpf_colaborador: string;
  nm_funcao: string;
  desc_funcao: string;
  centro_custo: string;
  email?: string | null;
  status: number;
  grupos: string[];
};

type AuthContextType = {
  user: Usuario | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: Usuario) => void;
  updateUser: (patch: Partial<Usuario>) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("auth_user");

      if (!token || !storedUser) {
        setLoading(false);
        return;
      }

      try {
        const data = await obterSessao();
        setUser(data.usuario);
        localStorage.setItem("auth_user", JSON.stringify(data.usuario));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("auth_user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  function login(token: string, userData: Usuario) {
    localStorage.setItem("token", token);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setUser(userData);
  }

  function updateUser(patch: Partial<Usuario>) {
    setUser((current) => {
      if (!current) {
        return current;
      }
      const next = { ...current, ...patch };
      localStorage.setItem("auth_user", JSON.stringify(next));
      return next;
    });
  }

  async function logout() {
    try {
      await axiosInstance.post("/auth/logout");
    } catch {
      // limpeza local mesmo com falha remota
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("auth_user");
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
}
