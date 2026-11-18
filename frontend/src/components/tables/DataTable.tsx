import { ReactNode, useEffect, useState } from "react";

type Column<T> = {
  id: string;
  title: string;
  accessor: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  title?: string;
  className?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  exportFileName?: string;
  showExport?: boolean;
  initialSortColumn?: string;
  initialSortDirection?: "asc" | "desc";
  emptyMessage?: string;
  /* Enquanto true e sem dados, a tabela mostra linhas de espera em vez da
     mensagem de vazio. Sem isso ela afirma "nenhum registro" durante a
     consulta - uma resposta que ainda nao existe. */
  carregando?: boolean;
};

const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  // Excel e LibreOffice avaliam a célula quando ela começa com =, +, -, @ ou controle.
  // Com dados de origem externa na tabela, isso executa fórmula na máquina de quem abre
  // o CSV. O apóstrofo neutraliza; o teste de número preserva negativos legítimos, que
  // de outro modo virariam texto em toda coluna numérica do portal.
  const seguro = INICIO_DE_FORMULA.test(text) && !Number.isFinite(Number(text)) ? `'${text}` : text;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export default function DataTable<T>({
  columns,
  data,
  title,
  className,
  searchPlaceholder = "Buscar na tabela",
  pageSize = 8,
  exportFileName = "export.csv",
  showExport = true,
  initialSortColumn,
  initialSortDirection = "desc",
  emptyMessage = "Nenhum registro encontrado.",
  carregando = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(
    initialSortColumn ?? columns.find((column) => column.sortable)?.id ?? columns[0]?.id ?? "",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialSortDirection);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = data.filter((row) =>
    !normalizedSearch ||
    columns.some((column) => String(column.accessor(row) ?? "").toLowerCase().includes(normalizedSearch)),
  );

  const sorted = [...filtered].sort((left, right) => {
    const column = columns.find((item) => item.id === sortColumn);
    if (!column) return 0;

    const leftValue = column.accessor(left);
    const rightValue = column.accessor(right);

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
    }

    const comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, data.length]);

  function handleSort(columnId: string, sortable?: boolean) {
    if (!sortable) return;

    if (sortColumn === columnId) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }

    setSortColumn(columnId);
    setSortDirection("desc");
  }

  function exportCsv() {
    const header = columns.map((column) => csvEscape(column.title)).join(";");
    const rows = sorted.map((row) => columns.map((column) => csvEscape(column.accessor(row))).join(";"));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = exportFileName;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className={`data-table${className ? ` ${className}` : ""}`}>
      <div className="data-table__toolbar">
        <div className="data-table__toolbar-meta">
          {title ? <h3>{title}</h3> : null}
          <span className="data-table__record-count">{sorted.length} registros</span>
        </div>

        <div className="data-table__toolbar-actions">
          <input
            className="data-table__search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
          />
          {showExport ? (
            <button className="button button--secondary" type="button" onClick={exportCsv}>
              Exportar CSV
            </button>
          ) : null}
        </div>
      </div>

      <div className="table-shell table-shell--sticky">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`${column.align === "right" ? "table__cell--right" : ""}${column.headerClassName ? ` ${column.headerClassName}` : ""}`}
                >
                  <button
                    className={`table__sort${column.sortable ? " table__sort--enabled" : ""}${column.align === "right" ? " table__sort--right" : ""}`}
                    type="button"
                    onClick={() => handleSort(column.id, column.sortable)}
                  >
                    {column.title}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length ? (
              paginated.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={column.align === "right" ? "table__cell--right" : column.align === "center" ? "table__cell--center" : ""}
                    >
                      {column.render ? column.render(row) : String(column.accessor(row) ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            ) : carregando ? (
              Array.from({ length: Math.min(pageSize, 6) }).map((_, linha) => (
                <tr key={`espera-${linha}`} aria-hidden="true">
                  {columns.map((column) => (
                    <td key={column.id}>
                      <span className="table__espera" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty-state empty-state--inline">{emptyMessage}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="data-table__footer">
        <span>
          Página {page} de {totalPages}
        </span>
        <div className="data-table__pagination">
          <button className="button button--ghost-neutral" type="button" disabled={page <= 1} onClick={() => setCurrentPage(page - 1)}>
            Anterior
          </button>
          <button
            className="button button--ghost-neutral"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setCurrentPage(page + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
