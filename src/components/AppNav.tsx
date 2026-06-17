import type { RoutePath } from "../types";

type AppNavProps = {
  route: RoutePath;
  navigate: (route: RoutePath) => void;
};

type NavIconName = "home" | "search" | "settings" | "lobby" | "game" | "claim" | "history";

const navItems: Array<{ route: RoutePath; label: string; icon: NavIconName }> = [
  { route: "/", label: "Home", icon: "home" },
  { route: "/find-match", label: "Find", icon: "search" },
  { route: "/matchmake", label: "Create", icon: "settings" },
  { route: "/lobby", label: "Lobby", icon: "lobby" },
  { route: "/game", label: "Game", icon: "game" },
  { route: "/settlement", label: "Claim", icon: "claim" },
  { route: "/history", label: "History", icon: "history" },
];

function NavIcon({ name }: { name: NavIconName }) {
  const common = "h-5 w-5";

  if (name === "home") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m3 10 9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 7h16" />
        <path d="M7 7v10" />
        <path d="M17 7v10" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (name === "lobby") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 5h16v14H4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    );
  }

  if (name === "game") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M7 8h10l3 8-3 2-2-3H9l-2 3-3-2 3-8Z" />
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
      </svg>
    );
  }

  if (name === "claim") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 3h12v18H6z" />
        <path d="M9 8h6" />
        <path d="m9 13 2 2 4-4" />
      </svg>
    );
  }

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function AppNav({ route, navigate }: AppNavProps) {
  return (
    <nav className="mb-5 overflow-x-auto pb-1" aria-label="Sentinel Quiz pages">
      <div className="flex min-w-max gap-2 lg:min-w-0">
        {navItems.map((item) => {
          const active = route === item.route;
          return (
            <button
              key={item.route}
              type="button"
              className={`group flex min-h-14 min-w-28 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-extrabold transition hover:scale-[1.02] hover:-translate-y-0.5 lg:min-w-0 ${
                active
                  ? "border-violet-500 bg-violet-950 text-white shadow-lg shadow-violet-950/30"
                  : "border-violet-900/60 bg-zinc-950 text-zinc-400 hover:border-violet-500 hover:bg-zinc-900 hover:text-white"
              }`}
              onClick={() => navigate(item.route)}
            >
              <span className={active ? "text-violet-200" : "text-zinc-500 group-hover:text-violet-300"}>
                <NavIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
