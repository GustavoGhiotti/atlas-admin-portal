import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Modal from "@/components/modals/Modal";
import { type NavigationItem } from "@/lib/navigation";

type CommandSearchProps = {
  commands: NavigationItem[];
};

export default function CommandSearch({ commands }: CommandSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("@");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("@");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return commands.filter((item) => {
      if (!normalized) return true;
      return [item.command, item.label, item.description, item.category, item.to]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [commands, query]);

  return (
    <>
      <button className="command-trigger" type="button" onClick={() => setOpen(true)}>
        <span className="command-trigger__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.2-4.2" />
          </svg>
        </span>
        <span>Buscar comando</span>
        <kbd>Ctrl K</kbd>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Central de comandos"
        description="Digite o atalho do modulo ou pesquise por nome, categoria ou rota."
      >
        <div className="command-search">
          <label className="field">
            <span>Pesquisar</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="@sms, @perfil, @imagens"
            />
          </label>

          <div className="command-list">
            {filtered.length ? (
              filtered.map((item) =>
                item.external ? (
                  <a
                    key={item.command}
                    className="command-item"
                    href={item.to}
                    onClick={() => setOpen(false)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <div className="command-item__meta">
                      <span>{item.command}</span>
                      <small>{item.category}</small>
                    </div>
                  </a>
                ) : (
                  <Link key={item.command} className="command-item" to={item.to} onClick={() => setOpen(false)}>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <div className="command-item__meta">
                      <span>{item.command}</span>
                      <small>{item.category}</small>
                    </div>
                  </Link>
                ),
              )
            ) : (
              <div className="empty-state">Nenhum comando encontrado para esse termo.</div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
