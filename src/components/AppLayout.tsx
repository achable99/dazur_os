import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const tabs = [
  { to: "/flujo-efectivo", label: "Flujo de Efectivo" },
  { to: "/clientes", label: "Clientes" },
  { to: "/facturacion", label: "Facturación" },
  { to: "/cotizador", label: "Cotizador" },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-6">
          <NavLink to="/flujo-efectivo" className="font-bold text-foreground tracking-tight text-base">
            DazurOS
          </NavLink>
          <nav className="hidden md:flex items-center gap-1 h-full">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `px-3 h-14 inline-flex items-center text-sm border-b-2 -mb-px transition-colors ${
                    isActive
                      ? "text-foreground border-foreground"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[160px]">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-4 border-t border-border overflow-x-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap ${
                  isActive
                    ? "text-foreground border-foreground"
                    : "text-muted-foreground border-transparent"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
