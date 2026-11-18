import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import axiosInstance from "@/services/axiosInstance";
import { ptBR } from "date-fns/locale";
import acmeIcon from "@/assets/icone-acme.png";

type Note = {
  id: string;
  date: string;
  horario_entrada: string;
  horario_saida: string;
  carteira: string;
  local_visita?: string | null;
  motivo_visita: string;
  status_visita?: string;
  resumo_visita?: string | null;
  o_que_foi_feito?: string | null;
  pendencias?: Pendencia[] | string | null;
  observacoes?: string | null;
  participantes?: Participante[];
  login_criacao?: string | null;
  nome_criacao?: string | null;
  login_atualizacao?: string | null;
  login_exclusao?: string | null;
  login_envio_ata?: string | null;
  created_at: string;
  updated_at: string | null;
  data_envio_ata?: string | null;
};

type Pendencia = {
  id?: number | null;
  descricao: string;
  responsavel?: string | null;
  observacao?: string | null;
  status_pendencia?: string | null;
  login_resolucao?: string | null;
  data_resolucao?: string | null;
};

type PendenciaAberta = {
  id: number;
  agenda_id: number;
  date: string;
  horario_entrada: string;
  horario_saida: string;
  carteira: string;
  motivo_visita: string;
  descricao: string;
  responsavel?: string | null;
  observacao?: string | null;
  status_pendencia?: string | null;
  created_at?: string | null;
};

type Participante = {
  id?: number | null;
  tipo: "INTERNO" | "EXTERNO";
  nome: string;
  area_cargo?: string | null;
  observacao?: string | null;
};

type CarteiraOption = {
  id_cedente: number;
  nome_cedente: string;
};

const api = axiosInstance;
const MAX_ATA_ATTACHMENTS = 5;
const MAX_ATA_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const VISIT_STATUS = ["AGENDADA", "REALIZADA", "CANCELADA", "REAGENDADA"];
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos os status" },
  ...VISIT_STATUS.map((status) => ({ value: status, label: status })),
];
const PENDENCIAS_FILTER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "COM", label: "Com pendencia" },
  { value: "SEM", label: "Sem pendencia" },
];
const VISIT_STATUS_OPTIONS = VISIT_STATUS.map((status) => ({ value: status, label: status }));
const FORM_TABS = [
  { id: "agendamento", label: "Agendamento" },
  { id: "registro", label: "Registro" },
  { id: "pendencias", label: "Pendencias" },
  { id: "observacoes", label: "Observacoes" },
] as const;
type FormTab = (typeof FORM_TABS)[number]["id"];
const EXPORT_TABS = [
  { id: "ata", label: "Ata" },
  { id: "relatorio", label: "Relatorio" },
] as const;
type ExportTab = (typeof EXPORT_TABS)[number]["id"];
const STATUS_STYLES: Record<string, string> = {
  AGENDADA: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  REALIZADA: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  CANCELADA: "border-red-400/40 bg-red-500/10 text-red-300",
  REAGENDADA: "border-amber-400/40 bg-amber-500/10 text-amber-300",
};
const STATUS_DOTS: Record<string, string> = {
  AGENDADA: "bg-sky-400",
  REALIZADA: "bg-emerald-400",
  CANCELADA: "bg-red-400",
  REAGENDADA: "bg-amber-400",
};

function statusClass(status?: string | null) {
  return STATUS_STYLES[String(status || "AGENDADA").toUpperCase()] || STATUS_STYLES.AGENDADA;
}

function statusDotClass(status?: string | null) {
  return STATUS_DOTS[String(status || "AGENDADA").toUpperCase()] || STATUS_DOTS.AGENDADA;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

function csvEscape(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  if (/[;"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(fileName: string, header: string[], rows: unknown[][]) {
  const content = [
    header.map(csvEscape).join(";"),
    ...rows.map((row) => row.map(csvEscape).join(";")),
  ].join("\n");
  const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

function getNotesFromResponse(data: unknown): Note[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data || typeof data !== "object") {
    return [];
  }

  const payload = data as { itens?: unknown; notas?: unknown; notes?: unknown };
  if (Array.isArray(payload.itens)) {
    return payload.itens as Note[];
  }
  if (Array.isArray(payload.notas)) {
    return payload.notas as Note[];
  }
  if (Array.isArray(payload.notes)) {
    return payload.notes as Note[];
  }
  return [];
}

function toLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatDateBR(value: string) {
  if (!value) return "-";
  return format(toLocalDate(value), "dd/MM/yyyy", { locale: ptBR });
}

function formatDateTimeBR(value: string) {
  if (!value) return "-";
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function timeRange(note: Note) {
  const entrada = (note.horario_entrada || "").slice(0, 5);
  const saida = (note.horario_saida || "").slice(0, 5);
  return saida ? `${entrada} - ${saida}` : entrada;
}

function formatFirstAndLastName(value?: string | null) {
  const names = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!names.length) return "";
  return names
    .map((name) => `${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()}`)
    .join(" ");
}

function createdByLabel(note: Note) {
  const creatorName = formatFirstAndLastName(note.nome_criacao);
  const creatorLogin = String(note.login_criacao || "").trim().toUpperCase();
  const creator = creatorName || creatorLogin;
  return creator ? `Criado por ${creator}` : "";
}

function createdByName(note: Note) {
  const creatorName = formatFirstAndLastName(note.nome_criacao);
  const creatorLogin = String(note.login_criacao || "").trim().toUpperCase();
  return creatorName || creatorLogin || "";
}

function auditUserLabel(name?: string | null, login?: string | null) {
  const displayName = formatFirstAndLastName(name);
  const displayLogin = String(login || "").trim().toUpperCase();
  return displayName || displayLogin || "-";
}

function getPendencias(note: Note | null): Pendencia[] {
  if (!note) return [];
  if (Array.isArray(note.pendencias)) {
    return note.pendencias.filter((item) => (item.descricao || "").trim());
  }
  const legacy = String(note.pendencias || "").trim();
  return legacy ? [{ id: null, descricao: legacy, responsavel: null, observacao: null }] : [];
}

function isPendenciaAberta(item: Pendencia) {
  return String(item.status_pendencia || "PENDENTE").toUpperCase() !== "RESOLVIDA";
}

function getPendenciasAbertas(note: Note | null) {
  return getPendencias(note).filter(isPendenciaAberta);
}

function getParticipantes(note: Note | null, tipo?: "INTERNO" | "EXTERNO"): Participante[] {
  const participantes = Array.isArray(note?.participantes)
    ? note.participantes.filter((item) => (item.nome || "").trim())
    : [];
  return tipo ? participantes.filter((item) => item.tipo === tipo) : participantes;
}

function hasPendencias(note: Note | null) {
  return getPendenciasAbertas(note).length > 0;
}

function formatPendenciasForCsv(note: Note) {
  return getPendencias(note)
    .map((item, index) => {
      const parts = [`${index + 1}. ${item.descricao}`];
      if (item.responsavel) parts.push(`Responsavel: ${item.responsavel}`);
      if (item.observacao) parts.push(`Obs: ${item.observacao}`);
      return parts.join(" | ");
    })
    .join(" / ");
}

function formatParticipantesForCsv(note: Note, tipo: "INTERNO" | "EXTERNO") {
  return getParticipantes(note, tipo)
    .map((item) => {
      const parts = [item.nome];
      if (item.area_cargo) parts.push(item.area_cargo);
      if (item.observacao) parts.push(`Obs: ${item.observacao}`);
      return parts.join(" | ");
    })
    .join(" / ");
}

function normalizeTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

const TIME_HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const TIME_MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: format(new Date(2026, index, 1), "MMM", { locale: ptBR }).replace(".", ""),
}));

type TimeFieldProps = {
  label: string;
  value: string;
  isOpen: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onToggle: () => void;
};

function TimeField({ label, value, isOpen, onChange, onClose, onToggle }: TimeFieldProps) {
  const [hour = "00", minute = "00"] = (value || "00:00").split(":");
  const minutes = TIME_MINUTES.includes(minute) ? TIME_MINUTES : [...TIME_MINUTES, minute].sort();

  const setHour = (nextHour: string) => {
    onChange(`${nextHour}:${minute}`);
  };

  const setMinute = (nextMinute: string) => {
    onChange(`${hour}:${nextMinute}`);
    onClose();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(normalizeTimeInput(event.target.value));
  };

  return (
    <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground">
      <span>{label}</span>
      <div
        className={[
          "flex w-full items-center gap-2 rounded-md border bg-input px-3 py-2.5 text-sm font-semibold text-foreground outline-none transition",
          isOpen ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60",
        ].join(" ")}
      >
        <input
          value={value}
          onChange={handleInputChange}
          onFocus={onToggle}
          placeholder="HH:MM"
          inputMode="numeric"
          maxLength={5}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none"
        />
      </div>

      {isOpen && (
        <div
          data-agenda-floating
          className="agenda-pop-in absolute left-0 right-0 top-full z-[70] mt-2 rounded-xl border border-border bg-card p-3 shadow-2xl"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-primary">Hora</p>
              <div className="grid max-h-56 grid-cols-3 gap-1 overflow-y-auto pr-1">
                {TIME_HOURS.map((item) => (
                  <button
                    key={`hour-${item}`}
                    type="button"
                    onClick={() => setHour(item)}
                    className={[
                      "agenda-pressable rounded-md border px-2 py-1.5 text-sm font-semibold",
                      item === hour
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary/40 text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-primary">Minuto</p>
              <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto pr-1">
                {minutes.map((item) => (
                  <button
                    key={`minute-${item}`}
                    type="button"
                    onClick={() => setMinute(item)}
                    className={[
                      "agenda-pressable rounded-md border px-2 py-1.5 text-sm font-semibold",
                      item === minute
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary/40 text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </label>
  );
}

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  isOpen: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function SelectField({ label, value, options, isOpen, onChange, onToggle }: SelectFieldProps) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground">
      <span>{label}</span>
      <button
        data-agenda-trigger
        type="button"
        onClick={onToggle}
        className={[
          "agenda-pressable flex w-full items-center justify-between rounded-md border bg-input px-3 py-2 text-left text-sm font-semibold leading-tight text-foreground outline-none",
          isOpen ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60",
        ].join(" ")}
      >
        <span>{selected?.label || "Selecione"}</span>
        <span
          aria-hidden="true"
          className={["text-muted-foreground transition-transform duration-200", isOpen ? "rotate-90" : ""].join(" ")}
        >
          &gt;
        </span>
      </button>

      {isOpen && (
        <div
          data-agenda-floating
          className="agenda-pop-in absolute left-0 top-full z-[80] mt-2 w-full overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-2xl"
        >
          {options.map((option) => (
            <button
              key={`${label}-${option.value || "all"}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(option.value)}
              className={[
                "agenda-pressable mb-1 block w-full appearance-none rounded-lg border px-3 py-2 text-left text-sm font-semibold leading-tight last:mb-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                option.value === value
                  ? "border-primary/60 bg-primary text-primary-foreground"
                  : "border-border bg-secondary/35 text-foreground hover:border-primary/60 hover:bg-primary hover:text-primary-foreground",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeight?: string;
  required?: boolean;
};

function RichTextEditor({ label, value, onChange, placeholder, minHeight = "min-h-28", required }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const empty = isRichTextEmpty(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const sanitized = sanitizeRichText(value);
    if (editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
  }, [value]);

  const sync = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(sanitizeRichText(editor.innerHTML));
  };

  const runCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    sync();
  };

  return (
    <div className="space-y-1 text-sm font-semibold text-muted-foreground">
      <span>
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      <div
        className={[
          "rounded-xl border bg-input transition",
          focused ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60",
        ].join(" ")}
      >
        <div className="flex flex-wrap gap-1 border-b border-border/80 p-2">
          {[
            { command: "bold", label: "B", title: "Negrito" },
            { command: "italic", label: "I", title: "Italico" },
            { command: "insertUnorderedList", label: "• Lista", title: "Lista com topicos" },
            { command: "insertOrderedList", label: "1. Lista", title: "Lista numerada" },
          ].map((item) => (
            <button
              key={item.command}
              type="button"
              title={item.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand(item.command)}
              className="agenda-pressable rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs font-bold text-foreground hover:border-primary/60 hover:bg-primary hover:text-primary-foreground"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            title="Limpar formatacao"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand("removeFormat")}
            className="agenda-pressable rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Limpar
          </button>
        </div>

        <div className="relative">
          {empty && !focused && (
            <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-medium text-muted-foreground/70">
              {placeholder}
            </span>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              sync();
            }}
            onInput={sync}
            onPaste={() => window.setTimeout(sync, 0)}
            className={[
              "rich-text-content w-full overflow-y-auto rounded-b-xl px-3 py-2 text-sm font-medium text-foreground outline-none",
              minHeight,
            ].join(" ")}
          />
        </div>
      </div>
    </div>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  isOpen: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function DateField({ label, value, isOpen, onChange, onToggle }: DateFieldProps) {
  const currentValue = value ? toLocalDate(value) : new Date();
  const [viewDate, setViewDate] = useState(currentValue);

  useEffect(() => {
    if (value) {
      setViewDate(toLocalDate(value));
    }
  }, [value]);

  const pickerDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    const arr: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [viewDate]);

  const selectedDate = value ? toLocalDate(value) : null;

  return (
    <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground">
      <span>{label}</span>
      <button
        data-agenda-trigger
        type="button"
        onClick={onToggle}
        className={[
          "agenda-pressable flex w-full items-center justify-between rounded-md border bg-input px-3 py-2 text-left text-sm font-semibold text-foreground outline-none",
          isOpen ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60",
        ].join(" ")}
      >
        <span>{value ? formatDateBR(value) : "Selecione uma data"}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        >
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3" />
          <path d="M16 3.5v3" />
          <path d="M4 9h16" />
        </svg>
      </button>

      {isOpen && (
        <div
          data-agenda-floating
          className="agenda-pop-in absolute left-0 top-full z-[70] mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-2xl"
        >
          <div className="mb-3 grid grid-cols-[30px_1fr_30px] items-center gap-2">
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, -1))}
              className="agenda-pressable flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/40 text-sm text-foreground hover:border-primary/50 hover:bg-muted"
              aria-label="Mes anterior"
            >
              {"<"}
            </button>
            <strong className="text-center text-sm capitalize text-foreground">
              {format(viewDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </strong>
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="agenda-pressable flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/40 text-sm text-foreground hover:border-primary/50 hover:bg-muted"
              aria-label="Proximo mes"
            >
              {">"}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {pickerDays.map((day) => {
              const key = fmt(day);
              const inMonth = isSameMonth(day, viewDate);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(key)}
                  className={[
                    "agenda-pressable flex h-7 items-center justify-center rounded-md border text-sm font-semibold",
                    inMonth ? "text-foreground" : "text-muted-foreground/40",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : isToday
                        ? "border border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-secondary/35 hover:border-primary/50 hover:bg-primary/15",
                  ].join(" ")}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                const today = fmt(new Date());
                setViewDate(new Date());
                onChange(today);
              }}
              className="agenda-pressable rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="agenda-pressable rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </label>
  );
}

type MonthFieldProps = {
  label: string;
  value: string;
  isOpen: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function formatMonthBR(value: string) {
  if (!value) return "Selecione um mes";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "Selecione um mes";
  return format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
}

function MonthField({ label, value, isOpen, onChange, onToggle }: MonthFieldProps) {
  const currentYear = Number(value.slice(0, 4)) || new Date().getFullYear();
  const currentMonth = value.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, "0");
  const [viewYear, setViewYear] = useState(currentYear);

  useEffect(() => {
    setViewYear(currentYear);
  }, [currentYear]);

  return (
    <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground">
      <span>{label}</span>
      <button
        data-agenda-trigger
        type="button"
        onClick={onToggle}
        className={[
          "agenda-pressable flex w-full items-center justify-between rounded-md border bg-input px-3 py-2 text-left text-sm font-semibold capitalize text-foreground outline-none",
          isOpen ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60",
        ].join(" ")}
      >
        <span>{formatMonthBR(value)}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        >
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3" />
          <path d="M16 3.5v3" />
          <path d="M4 9h16" />
        </svg>
      </button>

      {isOpen && (
        <div
          data-agenda-floating
          className="agenda-pop-in absolute left-0 top-full z-[70] mt-2 w-full min-w-[280px] rounded-xl border border-border bg-card p-3 shadow-2xl"
        >
          <div className="mb-3 grid grid-cols-[30px_1fr_30px] items-center gap-2">
            <button
              type="button"
              onClick={() => setViewYear((year) => year - 1)}
              className="agenda-pressable flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/40 text-sm text-foreground hover:border-primary/50 hover:bg-muted"
              aria-label="Ano anterior"
            >
              {"<"}
            </button>
            <strong className="text-center text-sm text-foreground">{viewYear}</strong>
            <button
              type="button"
              onClick={() => setViewYear((year) => year + 1)}
              className="agenda-pressable flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/40 text-sm text-foreground hover:border-primary/50 hover:bg-muted"
              aria-label="Proximo ano"
            >
              {">"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_OPTIONS.map((month) => {
              const monthValue = `${viewYear}-${month.value}`;
              const selected = viewYear === currentYear && month.value === currentMonth;
              return (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => onChange(monthValue)}
                  className={[
                    "agenda-pressable rounded-md border px-3 py-2 text-sm font-semibold capitalize",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "border-border bg-secondary/35 text-foreground hover:border-primary/50 hover:bg-primary/15",
                  ].join(" ")}
                >
                  {month.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onChange("")}
              className="agenda-pressable rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange(format(now, "yyyy-MM"));
              }}
              className="agenda-pressable rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              Este mes
            </button>
          </div>
        </div>
      )}
    </label>
  );
}

async function getAtaPrintStyles() {
  const styles = await Promise.all(
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(async (node) => {
      if (node instanceof HTMLLinkElement) {
        try {
          const response = await fetch(node.href);
          const css = await response.text();
          return `<style>${css}</style>`;
        } catch {
          return `<link rel="stylesheet" href="${node.href}" />`;
        }
      }
      return node.outerHTML;
    }),
  );
  return styles.join("\n");
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function cloneAtaElement(element: HTMLElement) {
  const printable = element.cloneNode(true) as HTMLElement;
  await Promise.all(
    Array.from(printable.querySelectorAll("img")).map(async (image) => {
      const source = image.src;
      if (!source || source.startsWith("data:")) return;
      try {
        const response = await fetch(source);
        const blob = await response.blob();
        image.setAttribute("src", await blobToDataUrl(blob));
      } catch {
        image.setAttribute("src", source);
      }
    }),
  );
  return printable;
}

async function buildAtaPrintHtml(element: HTMLElement, title: string, includeScreenPreview = true) {
  const printable = await cloneAtaElement(element);
  const styles = await getAtaPrintStyles();
  const screenStyles = includeScreenPreview
    ? `
          @media screen {
            body {
              background: #0f172a;
              padding: 24px;
            }

            .ata-print-shell {
              background: transparent;
            }

            [data-ata-print] {
              box-shadow: 0 24px 80px rgba(15, 23, 42, 0.35) !important;
            }
          }
      `
    : "";
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${styles}
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            margin: 0;
            background: #ffffff;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .ata-print-shell {
            display: flex;
            justify-content: center;
            width: 100%;
            background: #ffffff;
          }

          [data-ata-print] {
            width: 186mm !important;
            max-width: 186mm !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          [data-no-print] {
            display: none !important;
          }

          [data-ata-section] {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          [data-ata-section-title] {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          [data-ata-participants] {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 1.25rem !important;
          }

          .rich-text-content {
            white-space: normal;
          }

          .rich-text-content p,
          .rich-text-content div {
            margin: 0 0 0.45rem;
          }

          .rich-text-content p:last-child,
          .rich-text-content div:last-child {
            margin-bottom: 0;
          }

          .rich-text-content ul,
          .rich-text-content ol {
            margin: 0.35rem 0 0.45rem 1.25rem;
            padding: 0;
          }

          .rich-text-content li {
            margin: 0.15rem 0;
          }

          @media print {
            html,
            body,
            .ata-print-shell {
              background: #ffffff !important;
            }
          }

          ${screenStyles}
        </style>
      </head>
      <body>
        <div class="ata-print-shell">${printable.outerHTML}</div>
      </body>
    </html>
  `;
}

async function buildRelatorioPrintHtml(
  visitas: Note[],
  filtros: { inicio: string; fim: string; carteira: string; status: string },
) {
  const iconResponse = await fetch(acmeIcon);
  const iconDataUrl = await blobToDataUrl(await iconResponse.blob());
  const visitasComPendencias = visitas.filter((note) => hasPendencias(note)).length;
  const pendenciasRegistradas = visitas.reduce((total, note) => total + getPendencias(note).length, 0);
  const carteirasDistintas = new Set(visitas.map((note) => note.carteira.trim()).filter(Boolean)).size;
  const realizadas = visitas.filter((note) => String(note.status_visita || "").toUpperCase() === "REALIZADA").length;
  const agendadas = visitas.filter((note) => String(note.status_visita || "AGENDADA").toUpperCase() === "AGENDADA").length;
  const taxaRealizacao = visitas.length ? Math.round((realizadas / visitas.length) * 100) : 0;
  const statusResumo = VISIT_STATUS.map((status) => ({
    status,
    total: visitas.filter((note) => String(note.status_visita || "AGENDADA").toUpperCase() === status).length,
  })).filter((item) => item.total > 0);
  const carteiraResumo = Array.from(
    visitas.reduce((acc, note) => {
      const name = note.carteira.trim() || "Sem carteira";
      acc.set(name, (acc.get(name) || 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
  const resumoPorCarteira = Array.from(
    visitas.reduce((acc, note) => {
      const name = note.carteira.trim() || "Sem carteira";
      const current = acc.get(name) || { total: 0, realizadas: 0, pendencias: 0 };
      const isRealizada = String(note.status_visita || "").toUpperCase() === "REALIZADA";
      acc.set(name, {
        total: current.total + 1,
        realizadas: current.realizadas + (isRealizada ? 1 : 0),
        pendencias: current.pendencias + getPendencias(note).length,
      });
      return acc;
    }, new Map<string, { total: number; realizadas: number; pendencias: number }>()),
  ).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  const resumoCarteiraRows = resumoPorCarteira
    .map(
      ([carteiraNome, item]) => `
        <tr>
          <td><strong>${escapeHtml(carteiraNome)}</strong></td>
          <td>${item.total}</td>
          <td>${item.realizadas}</td>
          <td>${item.pendencias}</td>
        </tr>
      `,
    )
    .join("");
  const pendenciaRows = visitas
    .flatMap((note) =>
      getPendencias(note).map(
        (pendencia) => `
          <tr>
            <td>${escapeHtml(formatDateBR(note.date))}</td>
            <td><strong>${escapeHtml(note.carteira || "-")}</strong></td>
            <td>${escapeHtml(pendencia.descricao || "-")}</td>
            <td>${escapeHtml(pendencia.responsavel || "-")}</td>
          </tr>
        `,
      ),
    )
    .join("");

  const rows = visitas
    .map(
      (note) => `
        <tr>
          <td>${escapeHtml(formatDateBR(note.date))}</td>
          <td>${escapeHtml(timeRange(note))}</td>
          <td><strong>${escapeHtml(note.carteira || "-")}</strong></td>
          <td>${escapeHtml(note.local_visita || "-")}</td>
          <td><span class="status status-${escapeHtml(String(note.status_visita || "AGENDADA").toLowerCase())}">${escapeHtml(note.status_visita || "AGENDADA")}</span></td>
          <td><div class="rich-text-content">${sanitizeRichText(note.motivo_visita || "-")}</div></td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Relatorio de visitas</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; background: #ffffff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .page { width: 100%; padding: 0; }
          header { border-bottom: 2px solid #0f172a; padding-bottom: 18px; display: flex; justify-content: space-between; gap: 32px; }
          .brand { display: flex; align-items: center; gap: 8px; color: #f05a22; font-size: 11px; font-weight: 800; letter-spacing: 0.28em; text-transform: uppercase; }
          .brand img { height: 18px; width: auto; }
          h1 { margin: 10px 0 0; font-size: 28px; line-height: 1; text-transform: uppercase; letter-spacing: 0.03em; }
          .subtitle { margin-top: 12px; color: #64748b; font-size: 12px; }
          .doc { text-align: right; color: #64748b; font-size: 11px; line-height: 1.7; }
          .doc strong { display: block; color: #0f172a; text-transform: uppercase; }
          section { margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
          h2 { border-bottom: 1px solid #cbd5e1; color: #f05a22; font-size: 10px; letter-spacing: 0.24em; margin: 0 0 10px; padding-bottom: 7px; text-transform: uppercase; }
          .filters { display: grid; gap: 8px; grid-template-columns: 1fr 1fr 1.2fr 1fr; }
          .metrics { display: grid; gap: 8px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
          .box { border: 1px solid #d9e2ee; border-radius: 8px; padding: 8px 10px; min-height: 46px; }
          .label { color: #64748b; display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
          .value { color: #0f172a; display: block; font-size: 13px; font-weight: 900; margin-top: 4px; }
          .metric-number { font-size: 19px; font-weight: 900; margin-top: 2px; }
          .insights { align-items: center; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
          .chip { background: #f1f5f9; border: 1px solid #d9e2ee; border-radius: 999px; color: #334155; display: inline-block; font-size: 10px; font-weight: 800; padding: 4px 9px; }
          .chip-strong { background: #fff3ed; border-color: #f05a22; color: #d9480f; }
          .carteira-summary { color: #475569; font-size: 10px; margin-top: 7px; }
          table { border-collapse: separate; border-spacing: 0; width: 100%; overflow: hidden; border: 1px solid #d9e2ee; border-radius: 8px; font-size: 11px; }
          th { background: #eef3f8; color: #475569; font-size: 10px; letter-spacing: 0.08em; padding: 9px 8px; text-align: left; text-transform: uppercase; }
          td { border-top: 1px solid #d9e2ee; padding: 9px 8px; line-height: 1.45; vertical-align: top; }
          tbody tr:nth-child(even) td { background: #fbfdff; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .status { background: #f1f5f9; border-radius: 999px; color: #334155; display: inline-block; font-size: 10px; font-weight: 800; padding: 3px 8px; }
          .status-agendada { background: #e0f2fe; color: #0369a1; }
          .status-realizada { background: #dcfce7; color: #166534; }
          .status-cancelada { background: #fee2e2; color: #991b1b; }
          .status-reagendada { background: #fef3c7; color: #92400e; }
          .rich-text-content { white-space: normal; }
          .rich-text-content p, .rich-text-content div { margin: 0 0 6px; }
          .rich-text-content p:last-child, .rich-text-content div:last-child { margin-bottom: 0; }
          .rich-text-content ul, .rich-text-content ol { margin: 4px 0 6px 16px; padding: 0; }
          .rich-text-content li { margin: 2px 0; }
          footer { border-top: 1px solid #d9e2ee; color: #64748b; font-size: 10px; margin-top: 20px; padding-top: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <header>
            <div>
              <div class="brand"><img src="${iconDataUrl}" alt="" /> Grupo Acme</div>
              <h1>Relatorio de visitas</h1>
              <div class="subtitle">Agenda de visitas - Atlas | ${escapeHtml(formatDateBR(filtros.inicio))} a ${escapeHtml(formatDateBR(filtros.fim))}</div>
            </div>
            <div class="doc">
              <strong>Documento</strong>
              Relatorio gerencial<br />
              Gerado em ${escapeHtml(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }))}
            </div>
          </header>

          <section>
            <h2>Filtros aplicados</h2>
            <div class="filters">
              <div class="box"><span class="label">Data inicial</span><span class="value">${escapeHtml(formatDateBR(filtros.inicio))}</span></div>
              <div class="box"><span class="label">Data final</span><span class="value">${escapeHtml(formatDateBR(filtros.fim))}</span></div>
              <div class="box"><span class="label">Carteira</span><span class="value">${escapeHtml(filtros.carteira || "Todas")}</span></div>
              <div class="box"><span class="label">Status</span><span class="value">${escapeHtml(filtros.status || "Todos")}</span></div>
            </div>
          </section>

          <section>
            <h2>Resumo executivo</h2>
            <div class="metrics">
              <div class="box"><span class="label">Total de visitas</span><div class="metric-number">${visitas.length}</div></div>
              <div class="box"><span class="label">Carteiras</span><div class="metric-number">${carteirasDistintas}</div></div>
              <div class="box"><span class="label">Realizadas</span><div class="metric-number">${realizadas}</div></div>
              <div class="box"><span class="label">Taxa de realizacao</span><div class="metric-number">${taxaRealizacao}%</div></div>
              <div class="box"><span class="label">Visitas com pendencia</span><div class="metric-number">${visitasComPendencias}</div></div>
              <div class="box"><span class="label">Pendencias registradas</span><div class="metric-number">${pendenciasRegistradas}</div></div>
            </div>
            <div class="insights">
              <span class="chip chip-strong">Status no periodo</span>
              ${
                statusResumo.length
                  ? statusResumo.map((item) => `<span class="chip">${escapeHtml(item.status)}: ${item.total}</span>`).join("")
                  : `<span class="chip">AGENDADA: ${agendadas}</span>`
              }
            </div>
            ${
              carteiraResumo.length > 1
                ? `<div class="carteira-summary"><strong>Carteiras com mais visitas:</strong> ${escapeHtml(
                    carteiraResumo.map(([carteiraNome, total]) => `${carteiraNome}: ${total}`).join(" | "),
                  )}</div>`
                : ""
            }
          </section>

          ${
            resumoPorCarteira.length > 1
              ? `
                <section>
                  <h2>Resumo por carteira</h2>
                  <table class="compact-table">
                    <thead>
                      <tr>
                        <th>Carteira</th>
                        <th style="width: 14%">Visitas</th>
                        <th style="width: 14%">Realizadas</th>
                        <th style="width: 18%">Pendencias</th>
                      </tr>
                    </thead>
                    <tbody>${resumoCarteiraRows}</tbody>
                  </table>
                </section>
              `
              : ""
          }

          ${
            pendenciaRows
              ? `
                <section>
                  <h2>Visitas com pendencias</h2>
                  <table class="compact-table">
                    <thead>
                      <tr>
                        <th style="width: 10%">Data</th>
                        <th style="width: 22%">Carteira</th>
                        <th>Pendencia</th>
                        <th style="width: 18%">Responsavel</th>
                      </tr>
                    </thead>
                    <tbody>${pendenciaRows}</tbody>
                  </table>
                </section>
              `
              : ""
          }

          <section>
            <h2>Visitas encontradas</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 10%">Data</th>
                  <th style="width: 10%">Horario</th>
                  <th style="width: 18%">Carteira</th>
                  <th style="width: 15%">Local / Formato</th>
                  <th style="width: 11%">Status</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>

          <footer>Documento gerado pelo Atlas em ${escapeHtml(format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR }))}.</footer>
        </div>
      </body>
    </html>
  `;
}

function downloadBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeRichText(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(raw)) {
    return escapeHtml(raw).replace(/\r?\n/g, "<br>");
  }

  const template = document.createElement("template");
  template.innerHTML = raw;
  const allowedTags = new Set(["B", "BR", "DIV", "EM", "I", "LI", "OL", "P", "STRONG", "U", "UL"]);

  const cleanNode = (node: Node): Node | DocumentFragment => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const element = node as HTMLElement;
    const tag = element.tagName.toUpperCase();
    const container = allowedTags.has(tag)
      ? document.createElement(tag === "B" ? "strong" : tag === "I" ? "em" : tag.toLowerCase())
      : document.createDocumentFragment();

    Array.from(element.childNodes).forEach((child) => {
      container.appendChild(cleanNode(child));
    });
    return container;
  };

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes).forEach((node) => {
    fragment.appendChild(cleanNode(node));
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);
  return wrapper.innerHTML.trim();
}

function isRichTextEmpty(value: unknown) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sanitizeRichText(value);
  return !String(wrapper.textContent || "").replace(/\u00a0/g, " ").trim();
}

function richTextToPlainText(value: unknown) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sanitizeRichText(value);
  return String(wrapper.textContent || "").replace(/\s+/g, " ").trim();
}

function parseEmailRecipients(value: string) {
  const emails: string[] = [];
  for (const item of value.split(/[,;\s]+/)) {
    const email = item.trim().toLowerCase();
    if (!email || emails.includes(email)) continue;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { emails: [], error: `E-mail invalido: ${email}` };
    }
    emails.push(email);
  }
  if (emails.length > 20) {
    return { emails: [], error: "Informe no maximo 20 destinatarios." };
  }
  return { emails, error: "" };
}

function RichTextContent({ value, className = "" }: { value?: string | null; className?: string }) {
  const html = sanitizeRichText(value);
  if (!html || isRichTextEmpty(html)) {
    return <span className={className}>-</span>;
  }
  return <div className={["rich-text-content", className].filter(Boolean).join(" ")} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CalendarPage() {
  const today = new Date();
  const ataPrintRef = useRef<HTMLDivElement | null>(null);
  const ataPdfPreparingRef = useRef(false);
  const ataSendingRef = useRef(false);
  const ataDownloadingRef = useRef(false);
  const reportDownloadingRef = useRef(false);
  const todayKey = fmt(today);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState<Date>(today);

  const [notes, setNotes] = useState<Note[]>([]);
  const [openPendencias, setOpenPendencias] = useState<PendenciaAberta[]>([]);
  const [carteiras, setCarteiras] = useState<CarteiraOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Note | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [openPendenciasOpen, setOpenPendenciasOpen] = useState(false);
  const [resolvingPendenciaId, setResolvingPendenciaId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitialSnapshot, setFormInitialSnapshot] = useState<string | null>(null);
  const [formDiscardConfirmOpen, setFormDiscardConfirmOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<FormTab>("agendamento");
  const [openTimeField, setOpenTimeField] = useState<"entrada" | "saida" | null>(null);
  const [openDateField, setOpenDateField] = useState<
    "visita" | "filterInicio" | "filterFim" | "exportInicio" | "exportFim" | "ataMes" | null
  >(null);
  const [openSelectField, setOpenSelectField] = useState<
    "filterStatus" | "filterPendencias" | "statusVisita" | "exportStatus" | "ataStatus" | null
  >(null);
  const [carteiraOpen, setCarteiraOpen] = useState(false);
  const [filterCarteiraOpen, setFilterCarteiraOpen] = useState(false);
  const [exportCarteiraOpen, setExportCarteiraOpen] = useState(false);
  const [ataCarteiraOpen, setAtaCarteiraOpen] = useState(false);
  const [date, setDate] = useState(fmt(today));
  const [horarioEntrada, setHorarioEntrada] = useState("08:00");
  const [horarioSaida, setHorarioSaida] = useState("09:00");
  const [carteira, setCarteira] = useState("");
  const [localVisita, setLocalVisita] = useState("");
  const [motivoVisita, setMotivoVisita] = useState("");
  const [statusVisita, setStatusVisita] = useState("AGENDADA");
  const [resumoVisita, setResumoVisita] = useState("");
  const [oQueFoiFeito, setOQueFoiFeito] = useState("");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [participantesInternos, setParticipantesInternos] = useState<Participante[]>([]);
  const [participantesExternos, setParticipantesExternos] = useState<Participante[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [filterInicio, setFilterInicio] = useState("");
  const [filterFim, setFilterFim] = useState("");
  const [filterCarteira, setFilterCarteira] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPendencias, setFilterPendencias] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterResultsOpen, setFilterResultsOpen] = useState(false);
  const [selectedVisitOrigin, setSelectedVisitOrigin] = useState<"filters" | null>(null);
  const [exportTab, setExportTab] = useState<ExportTab>("ata");
  const [ataMes, setAtaMes] = useState(format(today, "yyyy-MM"));
  const [ataCarteira, setAtaCarteira] = useState("");
  const [ataStatus, setAtaStatus] = useState("");
  const [selectedAtaVisit, setSelectedAtaVisit] = useState<Note | null>(null);
  const [ataPreviewMessage, setAtaPreviewMessage] = useState<string | null>(null);
  const [ataPreviewOpen, setAtaPreviewOpen] = useState(false);
  const [ataSendOptionsOpen, setAtaSendOptionsOpen] = useState(false);
  const [ataManualRecipientsOpen, setAtaManualRecipientsOpen] = useState(false);
  const [ataSendConfirmOpen, setAtaSendConfirmOpen] = useState(false);
  const [ataSendMode, setAtaSendMode] = useState<"default" | "manual">("default");
  const [ataRecipientsText, setAtaRecipientsText] = useState("");
  const [ataRecipientsError, setAtaRecipientsError] = useState<string | null>(null);
  const [ataSending, setAtaSending] = useState(false);
  const [ataDownloading, setAtaDownloading] = useState(false);
  const [ataAttachments, setAtaAttachments] = useState<File[]>([]);
  const [ataPdfBlob, setAtaPdfBlob] = useState<Blob | null>(null);
  const [ataPdfPreparing, setAtaPdfPreparing] = useState(false);
  const [exportInicio, setExportInicio] = useState(fmt(startOfMonth(today)));
  const [exportFim, setExportFim] = useState(fmt(endOfMonth(today)));
  const [exportCarteira, setExportCarteira] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/agenda/notas");
      setNotes(getNotesFromResponse(data));
    } catch {
      setNotes([]);
      setError("Nao foi possivel conectar a API. Inicie o backend em :8000.");
    } finally {
      setLoading(false);
    }
  };

  const loadCarteiras = async () => {
    try {
      const { data } = await api.get("/agenda/carteiras");
      setCarteiras(Array.isArray(data) ? data : []);
    } catch {
      setCarteiras([]);
    }
  };

  const loadOpenPendencias = async () => {
    try {
      const { data } = await api.get("/agenda/pendencias-abertas");
      setOpenPendencias(Array.isArray(data) ? data : []);
    } catch {
      setOpenPendencias([]);
    }
  };

  useEffect(() => {
    load();
    loadCarteiras();
    loadOpenPendencias();
  }, []);

  useEffect(() => {
    setSelectedAtaVisit(null);
    setAtaPreviewMessage(null);
    setAtaPreviewOpen(false);
    setAtaSendOptionsOpen(false);
    setAtaManualRecipientsOpen(false);
    setAtaSendConfirmOpen(false);
    setAtaAttachments([]);
    setAtaPdfBlob(null);
    setAtaRecipientsText("");
    setAtaRecipientsError(null);
  }, [ataCarteira, ataMes, ataStatus]);

  useEffect(() => {
    setAtaPdfBlob(null);
  }, [selectedAtaVisit?.id]);

  const shouldLockPageScroll = Boolean(
    formOpen ||
      formDiscardConfirmOpen ||
      selectedVisit ||
      deleteTarget ||
      pendingOpen ||
      openPendenciasOpen ||
      filterResultsOpen ||
      exportOpen ||
      ataSendOptionsOpen ||
      ataManualRecipientsOpen ||
      ataSendConfirmOpen,
  );

  useEffect(() => {
    if (!shouldLockPageScroll) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const root = document.getElementById("root");
    const previousRootOverflow = root?.style.overflow;
    const previousRootOverscroll = root?.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    if (root) {
      root.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      if (root) {
        root.style.overflow = previousRootOverflow || "";
        root.style.overscrollBehavior = previousRootOverscroll || "";
      }
    };
  }, [shouldLockPageScroll]);

  useEffect(() => {
    const closeFloatingFields = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-agenda-floating]") || target?.closest("[data-agenda-trigger]")) {
        return;
      }
      setOpenDateField(null);
      setOpenTimeField(null);
      setOpenSelectField(null);
      setCarteiraOpen(false);
      setFilterCarteiraOpen(false);
      setExportCarteiraOpen(false);
      setAtaCarteiraOpen(false);
    };

    window.addEventListener("pointerdown", closeFloatingFields);
    return () => window.removeEventListener("pointerdown", closeFloatingFields);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (formDiscardConfirmOpen) {
        setFormDiscardConfirmOpen(false);
        return;
      }
      if (ataSendConfirmOpen) {
        setAtaSendConfirmOpen(false);
        return;
      }
      if (ataManualRecipientsOpen) {
        setAtaManualRecipientsOpen(false);
        return;
      }
      if (ataSendOptionsOpen) {
        setAtaSendOptionsOpen(false);
        return;
      }
      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }
      if (pendingOpen) {
        setPendingOpen(false);
        return;
      }
      if (openPendenciasOpen) {
        setOpenPendenciasOpen(false);
        return;
      }
      if (filterResultsOpen) {
        setFilterResultsOpen(false);
        return;
      }
      if (exportOpen) {
        if (ataPreviewOpen) {
          setAtaPreviewOpen(false);
          return;
        }
        if (openSelectField) {
          setOpenSelectField(null);
          return;
        }
        if (openDateField) {
          setOpenDateField(null);
          return;
        }
        if (exportCarteiraOpen) {
          setExportCarteiraOpen(false);
          return;
        }
        if (ataCarteiraOpen) {
          setAtaCarteiraOpen(false);
          return;
        }
        if (openSelectField) {
          setOpenSelectField(null);
          return;
        }
        setExportOpen(false);
        setAtaPreviewOpen(false);
          setAtaSendConfirmOpen(false);
          setAtaSendOptionsOpen(false);
          setAtaManualRecipientsOpen(false);
        setSelectedAtaVisit(null);
        setAtaPreviewMessage(null);
        setAtaAttachments([]);
        setAtaPdfBlob(null);
        return;
      }
      if (formOpen) {
        if (openSelectField) {
          setOpenSelectField(null);
          return;
        }
        if (openDateField) {
          setOpenDateField(null);
          return;
        }
        if (openTimeField) {
          setOpenTimeField(null);
          return;
        }
        if (carteiraOpen) {
          setCarteiraOpen(false);
          return;
        }
        closeForm();
        return;
      }
      if (openDateField) {
        setOpenDateField(null);
        return;
      }
      if (openSelectField) {
        setOpenSelectField(null);
        return;
      }
      if (filterCarteiraOpen) {
        setFilterCarteiraOpen(false);
        return;
      }
      if (exportCarteiraOpen) {
        setExportCarteiraOpen(false);
        return;
      }
      if (ataCarteiraOpen) {
        setAtaCarteiraOpen(false);
        return;
      }
      if (selectedVisit) {
        setSelectedVisitOrigin(null);
        setSelectedVisit(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    carteiraOpen,
    ataCarteiraOpen,
    ataPreviewOpen,
    ataSendConfirmOpen,
    ataManualRecipientsOpen,
    ataSendOptionsOpen,
    deleteTarget,
    exportCarteiraOpen,
    exportOpen,
    filterCarteiraOpen,
    filterResultsOpen,
    formDiscardConfirmOpen,
    formOpen,
    openDateField,
    openPendenciasOpen,
    openSelectField,
    openTimeField,
    pendingOpen,
    selectedVisit,
  ]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const arr: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [cursor]);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.horario_entrada || "").localeCompare(b.horario_entrada || "");
      }),
    [notes],
  );
  const filteredNotes = useMemo(() => {
    const carteiraSelecionada = filterCarteira.trim().toLowerCase();
    const statusSelecionado = filterStatus.trim().toUpperCase();

    return sortedNotes.filter((note) => {
      if (filterInicio && note.date < filterInicio) return false;
      if (filterFim && note.date > filterFim) return false;
      if (carteiraSelecionada && (note.carteira || "").trim().toLowerCase() !== carteiraSelecionada) {
        return false;
      }
      if (statusSelecionado && (note.status_visita || "AGENDADA").toUpperCase() !== statusSelecionado) {
        return false;
      }
      if (filterPendencias === "COM" && !hasPendencias(note)) return false;
      if (filterPendencias === "SEM" && hasPendencias(note)) return false;
      return true;
    });
  }, [filterCarteira, filterFim, filterInicio, filterPendencias, filterStatus, sortedNotes]);
  const hasActiveFilters = Boolean(
    filterInicio || filterFim || filterCarteira.trim() || filterStatus || filterPendencias,
  );

  const notesByDate = useMemo(() => {
    const m = new Map<string, Note[]>();
    filteredNotes.forEach((n) => {
      const arr = m.get(n.date) ?? [];
      arr.push(n);
      m.set(n.date, arr);
    });
    return m;
  }, [filteredNotes]);

  const selectedKey = fmt(selected);
  const dayNotes = notesByDate.get(selectedKey) ?? [];

  const monthKey = format(cursor, "yyyy-MM");
  const monthNotes = useMemo(
    () => filteredNotes.filter((note) => note.date.startsWith(monthKey)),
    [filteredNotes, monthKey],
  );
  const uniqueCarteirasMonth = new Set(monthNotes.map((note) => note.carteira.trim()).filter(Boolean)).size;
  const currentMonthKey = format(today, "yyyy-MM");
  const scheduledVisits = filteredNotes.filter(
    (note) =>
      note.date >= todayKey &&
      note.date.startsWith(currentMonthKey) &&
      String(note.status_visita || "AGENDADA").toUpperCase() === "AGENDADA",
  );
  const scheduledNotes = scheduledVisits.length;
  const filteredCarteiras = useMemo(() => {
    const query = carteira.trim().toLowerCase();
    const unique = new Map<string, CarteiraOption>();
    carteiras.forEach((item) => {
      const name = item.nome_cedente.trim();
      if (!name) return;
      if (query && !name.toLowerCase().includes(query)) return;
      unique.set(name.toLowerCase(), item);
    });
    return Array.from(unique.values());
  }, [carteira, carteiras]);
  const filteredFilterCarteiras = useMemo(() => {
    const query = filterCarteira.trim().toLowerCase();
    const unique = new Map<string, CarteiraOption>();
    carteiras.forEach((item) => {
      const name = item.nome_cedente.trim();
      if (!name) return;
      if (query && !name.toLowerCase().includes(query)) return;
      unique.set(name.toLowerCase(), item);
    });
    return Array.from(unique.values());
  }, [filterCarteira, carteiras]);
  const filteredExportCarteiras = useMemo(() => {
    const query = exportCarteira.trim().toLowerCase();
    const unique = new Map<string, CarteiraOption>();
    carteiras.forEach((item) => {
      const name = item.nome_cedente.trim();
      if (!name) return;
      if (query && !name.toLowerCase().includes(query)) return;
      unique.set(name.toLowerCase(), item);
    });
    return Array.from(unique.values());
  }, [exportCarteira, carteiras]);
  const filteredAtaCarteiras = useMemo(() => {
    const query = ataCarteira.trim().toLowerCase();
    const unique = new Map<string, CarteiraOption>();
    carteiras.forEach((item) => {
      const name = item.nome_cedente.trim();
      if (!name) return;
      if (query && !name.toLowerCase().includes(query)) return;
      unique.set(name.toLowerCase(), item);
    });
    return Array.from(unique.values());
  }, [ataCarteira, carteiras]);
  const ataVisits = useMemo(() => {
    const carteiraSelecionada = ataCarteira.trim().toLowerCase();
    const statusSelecionado = ataStatus.trim().toUpperCase();

    return sortedNotes.filter((note) => {
      if (ataMes && !note.date.startsWith(ataMes)) return false;
      if (carteiraSelecionada && (note.carteira || "").trim().toLowerCase() !== carteiraSelecionada) {
        return false;
      }
      if (statusSelecionado && (note.status_visita || "AGENDADA").toUpperCase() !== statusSelecionado) {
        return false;
      }
      return true;
    });
  }, [ataCarteira, ataMes, ataStatus, sortedNotes]);
  const selectedAtaParticipantesInternos = getParticipantes(selectedAtaVisit, "INTERNO");
  const selectedAtaParticipantesExternos = getParticipantes(selectedAtaVisit, "EXTERNO");
  const selectedAtaPendencias = getPendencias(selectedAtaVisit);
  const hasSelectedAtaParticipantes =
    selectedAtaParticipantesInternos.length > 0 || selectedAtaParticipantesExternos.length > 0;
  const hasSelectedAtaResumo = !isRichTextEmpty(selectedAtaVisit?.resumo_visita);
  const hasSelectedAtaFeito = !isRichTextEmpty(selectedAtaVisit?.o_que_foi_feito);
  const hasSelectedAtaObservacoes = !isRichTextEmpty(selectedAtaVisit?.observacoes);
  const ataManualRecipients = parseEmailRecipients(ataRecipientsText);
  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        date,
        horarioEntrada,
        horarioSaida,
        carteira: carteira.trim(),
        localVisita: localVisita.trim(),
        motivoVisita: sanitizeRichText(motivoVisita),
        statusVisita,
        resumoVisita: sanitizeRichText(resumoVisita),
        oQueFoiFeito: sanitizeRichText(oQueFoiFeito),
        pendencias: pendencias
          .map((item) => ({
            id: item.id || null,
            descricao: item.descricao.trim(),
            responsavel: item.responsavel?.trim() || "",
            observacao: item.observacao?.trim() || "",
            status_pendencia: item.status_pendencia || "PENDENTE",
          }))
          .filter((item) => item.id || item.descricao || item.responsavel || item.observacao),
        participantesInternos: participantesInternos
          .map((item) => ({
            nome: item.nome.trim(),
            area_cargo: item.area_cargo?.trim() || "",
            observacao: item.observacao?.trim() || "",
          }))
          .filter((item) => item.nome || item.area_cargo || item.observacao),
        participantesExternos: participantesExternos
          .map((item) => ({
            nome: item.nome.trim(),
            area_cargo: item.area_cargo?.trim() || "",
            observacao: item.observacao?.trim() || "",
          }))
          .filter((item) => item.nome || item.area_cargo || item.observacao),
        observacoes: sanitizeRichText(observacoes),
      }),
    [
      carteira,
      date,
      horarioEntrada,
      horarioSaida,
      localVisita,
      motivoVisita,
      oQueFoiFeito,
      observacoes,
      participantesExternos,
      participantesInternos,
      pendencias,
      resumoVisita,
      statusVisita,
    ],
  );
  const formHasUnsavedChanges = formOpen && formInitialSnapshot !== null && formSnapshot !== formInitialSnapshot;

  useEffect(() => {
    if (formOpen && formInitialSnapshot === null) {
      setFormInitialSnapshot(formSnapshot);
    }
  }, [formInitialSnapshot, formOpen, formSnapshot]);

  const selectDate = (d: Date) => {
    setSelected(d);
    setCursor(d);
    setDate(fmt(d));
  };

  const startEdit = (n: Note) => {
    const nextDate = toLocalDate(n.date);
    setFormInitialSnapshot(null);
    setFormDiscardConfirmOpen(false);
    setSelectedVisitOrigin(null);
    setSelectedVisit(null);
    setEditing(n);
    setSelected(nextDate);
    setCursor(nextDate);
    setDate(n.date);
    setHorarioEntrada((n.horario_entrada || "08:00").slice(0, 5));
    setHorarioSaida((n.horario_saida || "09:00").slice(0, 5));
    setCarteira(n.carteira || "");
    setLocalVisita(n.local_visita || "");
    setMotivoVisita(n.motivo_visita || "");
    setStatusVisita(n.status_visita || "AGENDADA");
    setResumoVisita(n.resumo_visita || "");
    setOQueFoiFeito(n.o_que_foi_feito || "");
    setPendencias(getPendencias(n).map((item) => ({ ...item })));
    setParticipantesInternos(getParticipantes(n, "INTERNO").map((item) => ({ ...item })));
    setParticipantesExternos(getParticipantes(n, "EXTERNO").map((item) => ({ ...item })));
    setObservacoes(n.observacoes || "");
    setActiveFormTab("agendamento");
    setFormOpen(true);
  };

  const reset = (baseDate = fmt(selected)) => {
    setEditing(null);
    setDate(baseDate);
    setHorarioEntrada("08:00");
    setHorarioSaida("09:00");
    setCarteira("");
    setLocalVisita("");
    setMotivoVisita("");
    setStatusVisita("AGENDADA");
    setResumoVisita("");
    setOQueFoiFeito("");
    setPendencias([]);
    setParticipantesInternos([]);
    setParticipantesExternos([]);
    setObservacoes("");
  };

  const openCreate = () => {
    setFormInitialSnapshot(null);
    setFormDiscardConfirmOpen(false);
    reset(fmt(selected));
    setActiveFormTab("agendamento");
    setFormOpen(true);
  };

  const closeForm = (discardChanges = false) => {
    if (!discardChanges && formHasUnsavedChanges) {
      setOpenTimeField(null);
      setOpenDateField(null);
      setOpenSelectField(null);
      setCarteiraOpen(false);
      setFormDiscardConfirmOpen(true);
      return;
    }
    setFormOpen(false);
    setFormInitialSnapshot(null);
    setFormDiscardConfirmOpen(false);
    setOpenTimeField(null);
    setOpenDateField(null);
    setCarteiraOpen(false);
    setFilterCarteiraOpen(false);
    setExportCarteiraOpen(false);
    reset();
  };

  const clearFilters = () => {
    setFilterInicio("");
    setFilterFim("");
    setFilterCarteira("");
    setFilterStatus("");
    setFilterPendencias("");
    setFilterCarteiraOpen(false);
    setOpenDateField(null);
    setFilterResultsOpen(false);
  };

  const applyFilters = () => {
    setOpenDateField(null);
    setFilterCarteiraOpen(false);
    setFilterOpen(false);
    setFilterResultsOpen(true);
  };

  const addPendencia = () => {
    setPendencias((current) => [...current, { descricao: "", responsavel: "", observacao: "" }]);
  };

  const updatePendencia = (index: number, field: keyof Pendencia, value: string) => {
    setPendencias((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  };

  const removePendencia = (index: number) => {
    setPendencias((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addParticipante = (tipo: "INTERNO" | "EXTERNO") => {
    const participante: Participante = { tipo, nome: "", area_cargo: "", observacao: "" };
    if (tipo === "INTERNO") {
      setParticipantesInternos((current) => [...current, participante]);
      return;
    }
    setParticipantesExternos((current) => [...current, participante]);
  };

  const updateParticipante = (
    tipo: "INTERNO" | "EXTERNO",
    index: number,
    field: keyof Participante,
    value: string,
  ) => {
    const updater = (current: Participante[]) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item));
    if (tipo === "INTERNO") {
      setParticipantesInternos(updater);
      return;
    }
    setParticipantesExternos(updater);
  };

  const removeParticipante = (tipo: "INTERNO" | "EXTERNO", index: number) => {
    const updater = (current: Participante[]) => current.filter((_, itemIndex) => itemIndex !== index);
    if (tipo === "INTERNO") {
      setParticipantesInternos(updater);
      return;
    }
    setParticipantesExternos(updater);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !carteira.trim() || isRichTextEmpty(motivoVisita)) return;

    const payload = {
      date,
      horario_entrada: horarioEntrada,
      horario_saida: horarioSaida,
      carteira,
      local_visita: localVisita.trim() || null,
      motivo_visita: sanitizeRichText(motivoVisita),
      status_visita: statusVisita,
      resumo_visita: sanitizeRichText(resumoVisita),
      o_que_foi_feito: sanitizeRichText(oQueFoiFeito),
      pendencias: pendencias
        .filter((item) => item.descricao.trim())
        .map((item) => ({
          id: item.id || null,
          descricao: item.descricao.trim(),
          responsavel: item.responsavel?.trim() || null,
          observacao: item.observacao?.trim() || null,
          status_pendencia: item.status_pendencia || "PENDENTE",
          login_resolucao: item.login_resolucao || null,
          data_resolucao: item.data_resolucao || null,
        })),
      observacoes: sanitizeRichText(observacoes),
      participantes: [...participantesInternos, ...participantesExternos]
        .filter((item) => item.nome.trim())
        .map((item) => ({
          tipo: item.tipo,
          nome: item.nome.trim(),
          area_cargo: item.area_cargo?.trim() || null,
          observacao: item.observacao?.trim() || null,
        })),
    };

    try {
      if (editing) {
        await api.put(`/agenda/notas/${editing.id}`, payload);
      } else {
        await api.post("/agenda/notas", payload);
      }
      const nextDate = toLocalDate(date);
      setSelected(nextDate);
      setCursor(nextDate);
      reset(date);
      setFormInitialSnapshot(null);
      setFormDiscardConfirmOpen(false);
      setFormOpen(false);
      await load();
      loadOpenPendencias();
    } catch {
      setError("Falha ao salvar.");
    }
  };

  const confirmRemove = (note: Note) => {
    setDeleteTarget(note);
  };

  const remove = async () => {
    if (!deleteTarget) return;

    try {
      await api.delete(`/agenda/notas/${deleteTarget.id}`);
      if (editing?.id === deleteTarget.id) {
        reset();
        setFormInitialSnapshot(null);
        setFormDiscardConfirmOpen(false);
        setFormOpen(false);
      }
      if (selectedVisit?.id === deleteTarget.id) {
        setSelectedVisitOrigin(null);
        setSelectedVisit(null);
      }
      setDeleteTarget(null);
      await load();
      loadOpenPendencias();
    } catch {
      setError("Falha ao excluir.");
    }
  };

  const resolvePendencia = async (note: Note, pendencia: Pendencia) => {
    if (!pendencia.id) return;
    setResolvingPendenciaId(pendencia.id);
    setError(null);
    try {
      const { data } = await api.patch(`/agenda/notas/${note.id}/pendencias/${pendencia.id}/resolver`);
      const updated = data as Note;
      setNotes((current) => current.map((item) => (String(item.id) === String(updated.id) ? updated : item)));
      setSelectedVisit((current) => (current && String(current.id) === String(updated.id) ? updated : current));
      await loadOpenPendencias();
    } catch {
      setError("Falha ao resolver pendencia.");
    } finally {
      setResolvingPendenciaId(null);
    }
  };

  const exportVisits = async () => {
    if (reportDownloadingRef.current) return;

    setExportMessage(null);
    if (!exportInicio || !exportFim) {
      setExportMessage("Informe a data inicial e a data final para exportar.");
      return;
    }
    if (exportInicio > exportFim) {
      setExportMessage("A data inicial precisa ser menor ou igual a data final.");
      return;
    }

    const carteiraSelecionada = exportCarteira.trim().toLowerCase();
    const statusSelecionado = exportStatus.trim().toUpperCase();
    const visitas = sortedNotes.filter((note) => {
      const dentroPeriodo = note.date >= exportInicio && note.date <= exportFim;
      if (!dentroPeriodo) return false;
      if (carteiraSelecionada && (note.carteira || "").trim().toLowerCase() !== carteiraSelecionada) {
        return false;
      }
      if (statusSelecionado && (note.status_visita || "AGENDADA").toUpperCase() !== statusSelecionado) {
        return false;
      }
      return true;
    });

    if (!visitas.length) {
      setExportMessage("Nenhuma visita encontrada para os filtros selecionados.");
      return;
    }

    reportDownloadingRef.current = true;
    setReportDownloading(true);
    try {
      const html = await buildRelatorioPrintHtml(visitas, {
        inicio: exportInicio,
        fim: exportFim,
        carteira: exportCarteira.trim(),
        status: exportStatus.trim(),
      });
      const { data } = await api.post("/agenda/relatorio-pdf", { html }, { responseType: "blob" });
      downloadBlob(data, `relatorio-visitas-${exportInicio}-a-${exportFim}.pdf`);
      setExportMessage("Relatorio baixado com sucesso.");
    } catch {
      setExportMessage("Falha ao baixar o relatorio em PDF.");
    } finally {
      reportDownloadingRef.current = false;
      setReportDownloading(false);
    }
  };

  const sendAtaEmail = async () => {
    if (!selectedAtaVisit || !ataPrintRef.current) return;
    if (ataSendingRef.current || ataDownloadingRef.current) return;
    const manualRecipients = ataSendMode === "manual" ? parseEmailRecipients(ataRecipientsText) : { emails: [], error: "" };
    if (manualRecipients.error || (ataSendMode === "manual" && manualRecipients.emails.length === 0)) {
      setAtaRecipientsError(manualRecipients.error || "Informe ao menos um destinatario.");
      setAtaSendConfirmOpen(false);
      setAtaManualRecipientsOpen(true);
      return;
    }

    ataSendingRef.current = true;
    setAtaSending(true);
    setAtaPreviewMessage(null);
    try {
      const title = `ATA-${String(selectedAtaVisit.id).padStart(5, "0")}`;
      const html = await buildAtaPrintHtml(ataPrintRef.current, title, false);
      const pdf = ataPdfBlob || (await prepareAtaPdf(false));
      const formData = new FormData();
      formData.append("html", html);
      if (pdf) {
        formData.append("pdf_ata", pdf, `ata-reuniao-${selectedAtaVisit.id}.pdf`);
      }
      if (ataSendMode === "manual") {
        formData.append("destinatarios", manualRecipients.emails.join(";"));
      }
      ataAttachments.forEach((file) => formData.append("arquivos", file));
      const { data } = await api.post(`/agenda/notas/${selectedAtaVisit.id}/enviar-ata`, formData);
      const payload = data as { enviado_em_formatado?: string; destino?: string };
      const enviadoEm = payload.enviado_em_formatado || format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const destino = payload.destino || "diretoria/gerencia";
      setAtaPreviewMessage(`ATA enviada para ${destino} em ${enviadoEm}.`);
      setAtaAttachments([]);
      setAtaSendMode("default");
      setAtaRecipientsText("");
      setAtaRecipientsError(null);
    } catch {
      setAtaPreviewMessage("Falha ao enviar a ATA por email.");
    } finally {
      ataSendingRef.current = false;
      setAtaSending(false);
    }
  };

  const addAtaAttachments = (files: FileList | null) => {
    if (!files?.length) return;

    const incoming = Array.from(files);
    const validFiles = incoming.filter((file) => file.size <= MAX_ATA_ATTACHMENT_SIZE);
    if (validFiles.length !== incoming.length) {
      setAtaPreviewMessage("Cada anexo complementar deve ter no maximo 10 MB.");
    }

    setAtaAttachments((current) => {
      const next = [...current, ...validFiles].slice(0, MAX_ATA_ATTACHMENTS);
      if (current.length + validFiles.length > MAX_ATA_ATTACHMENTS) {
        setAtaPreviewMessage(`Envie no maximo ${MAX_ATA_ATTACHMENTS} anexos complementares.`);
      }
      return next;
    });
  };

  const removeAtaAttachment = (index: number) => {
    setAtaAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const prepareAtaPdf = async (showError = false) => {
    if (!selectedAtaVisit || !ataPrintRef.current) return null;
    if (ataPdfBlob) return ataPdfBlob;
    if (ataPdfPreparingRef.current) return null;

    ataPdfPreparingRef.current = true;
    setAtaPdfPreparing(true);
    try {
      const title = `ATA-${String(selectedAtaVisit.id).padStart(5, "0")}`;
      const html = await buildAtaPrintHtml(ataPrintRef.current, title, false);
      const { data } = await api.post(`/agenda/notas/${selectedAtaVisit.id}/ata-pdf`, { html }, { responseType: "blob" });
      setAtaPdfBlob(data);
      return data as Blob;
    } catch {
      if (showError) {
        setAtaPreviewMessage("Falha ao preparar o PDF da ATA.");
      }
      return null;
    } finally {
      ataPdfPreparingRef.current = false;
      setAtaPdfPreparing(false);
    }
  };

  const downloadAtaPdf = async () => {
    if (!selectedAtaVisit || !ataPrintRef.current) return;
    if (ataDownloadingRef.current || ataSendingRef.current) return;

    ataDownloadingRef.current = true;
    setAtaDownloading(true);
    setAtaPreviewMessage(null);
    try {
      const pdf = await prepareAtaPdf(true);
      if (!pdf) return;
      downloadBlob(pdf, `ata-reuniao-${selectedAtaVisit.id}.pdf`);
      setAtaPreviewMessage("PDF baixado com sucesso.");
    } catch {
      setAtaPreviewMessage("Falha ao baixar o PDF da ATA.");
    } finally {
      ataDownloadingRef.current = false;
      setAtaDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-[1240px] px-6 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3.5v3" />
                  <path d="M16 3.5v3" />
                  <path d="M4 9h16" />
                  <path d="M8 13h2" />
                  <path d="M12 13h2" />
                  <path d="M16 13h1" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-primary">Painel operacional</p>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">Agenda de visitas</h1>
                <p className="mt-1 max-w-[420px] text-sm text-muted-foreground">
                  Planeje, registre e acompanhe as visitas de clientes na empresa.
                </p>
              </div>
            </div>

            <div className="w-full rounded-2xl border border-border bg-card p-2 sm:w-auto xl:min-w-[430px]">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="rounded-xl bg-secondary/35 px-3 py-2">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    Visitas no mes
                  </span>
                  <strong className="mt-1 block text-sm">{monthNotes.length}</strong>
                </div>
                <div className="rounded-xl bg-secondary/35 px-3 py-2">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Carteiras</span>
                  <strong className="mt-1 block text-sm">{uniqueCarteirasMonth}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                  className="agenda-pressable flex min-h-[54px] items-center justify-center gap-2 rounded-xl border-0 bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
                  aria-expanded={filterOpen}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <span>Filtros</span>
                  {hasActiveFilters && (
                    <span className="rounded-full bg-background/20 px-2 py-0.5 text-[11px] font-bold text-white">
                      {filteredNotes.length}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={[
                      "inline-flex transition-transform duration-300 ease-out",
                      filterOpen ? "rotate-90" : "",
                    ].join(" ")}
                  >
                    &gt;
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div
            className={[
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              filterOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            ].join(" ")}
          >
            <div className={filterOpen ? "overflow-visible" : "overflow-hidden"}>
              <div className="agenda-pop-in mt-4 rounded-2xl border border-border bg-card p-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">Filtros da agenda</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? `${filteredNotes.length} visita(s) encontrada(s).`
                        : "Sem filtros aplicados."}
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="agenda-pressable rounded-md border-0 bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <DateField
                    label="Data inicial"
                    value={filterInicio}
                    isOpen={openDateField === "filterInicio"}
                    onChange={(nextDate) => {
                      setFilterInicio(nextDate);
                      setOpenDateField(null);
                    }}
                    onToggle={() => {
                      setOpenTimeField(null);
                      setCarteiraOpen(false);
                      setFilterCarteiraOpen(false);
                      setExportCarteiraOpen(false);
                      setOpenSelectField(null);
                      setOpenDateField((current) => (current === "filterInicio" ? null : "filterInicio"));
                    }}
                  />
                  <DateField
                    label="Data final"
                    value={filterFim}
                    isOpen={openDateField === "filterFim"}
                    onChange={(nextDate) => {
                      setFilterFim(nextDate);
                      setOpenDateField(null);
                    }}
                    onToggle={() => {
                      setOpenTimeField(null);
                      setCarteiraOpen(false);
                      setFilterCarteiraOpen(false);
                      setExportCarteiraOpen(false);
                      setOpenSelectField(null);
                      setOpenDateField((current) => (current === "filterFim" ? null : "filterFim"));
                    }}
                  />
                  <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground">
                    <span>Carteira</span>
                    <input
                      data-agenda-trigger
                      value={filterCarteira}
                      onFocus={() => {
                        setOpenDateField(null);
                        setExportCarteiraOpen(false);
                        setOpenSelectField(null);
                        setFilterCarteiraOpen(true);
                      }}
                      onChange={(e) => {
                        setOpenDateField(null);
                        setOpenSelectField(null);
                        setFilterCarteira(e.target.value);
                        setFilterCarteiraOpen(true);
                      }}
                      placeholder="Todas as carteiras"
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    {filterCarteiraOpen && (
                      <div
                        data-agenda-floating
                        className="agenda-pop-in absolute left-0 top-full z-[70] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                      >
                        {filteredFilterCarteiras.length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma carteira encontrada.</p>
                        )}
                        {filteredFilterCarteiras.map((item) => (
                          <button
                            key={`filter-${item.id_cedente}-${item.nome_cedente}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setFilterCarteira(item.nome_cedente);
                              setFilterCarteiraOpen(false);
                            }}
                            className="agenda-pressable mb-1 block w-full appearance-none rounded-lg border border-border bg-secondary/35 px-3 py-2.5 text-left text-sm font-semibold text-foreground last:mb-0 hover:border-primary/60 hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            {item.nome_cedente}
                          </button>
                        ))}
                      </div>
                    )}
                  </label>
                  <SelectField
                    label="Status"
                    value={filterStatus}
                    options={STATUS_FILTER_OPTIONS}
                    isOpen={openSelectField === "filterStatus"}
                    onChange={(value) => {
                      setFilterStatus(value);
                      setOpenSelectField(null);
                    }}
                    onToggle={() => {
                      setOpenDateField(null);
                      setFilterCarteiraOpen(false);
                      setExportCarteiraOpen(false);
                      setOpenSelectField((current) => (current === "filterStatus" ? null : "filterStatus"));
                    }}
                  />
                  <SelectField
                    label="Pendencias"
                    value={filterPendencias}
                    options={PENDENCIAS_FILTER_OPTIONS}
                    isOpen={openSelectField === "filterPendencias"}
                    onChange={(value) => {
                      setFilterPendencias(value);
                      setOpenSelectField(null);
                    }}
                    onToggle={() => {
                      setOpenDateField(null);
                      setFilterCarteiraOpen(false);
                      setExportCarteiraOpen(false);
                      setOpenSelectField((current) => (current === "filterPendencias" ? null : "filterPendencias"));
                    }}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="agenda-pressable rounded-md border-0 bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
                  >
                    Aplicar filtro
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1240px] gap-8 px-6 py-6 xl:grid-cols-[minmax(440px,500px)_minmax(390px,1fr)] xl:items-start">
        <section className="w-full space-y-4">
          <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="w-full">
              <p className="text-xs font-bold text-foreground">Calendario</p>

              <div className="mt-4 grid grid-cols-[28px_1fr_28px] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCursor(addMonths(cursor, -1))}
                  className="flex h-8 w-8 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-base font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  style={{ background: "transparent", border: 0 }}
                  aria-label="Mes anterior"
                >
                  {"<"}
                </button>
                <h2 className="text-center text-base font-bold capitalize">
                  {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
                </h2>
                <button
                  type="button"
                  onClick={() => setCursor(addMonths(cursor, 1))}
                  className="flex h-8 w-8 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-base font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  style={{ background: "transparent", border: 0 }}
                  aria-label="Proximo mes"
                >
                  {">"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => selectDate(new Date())}
                className="mx-auto mt-2 block appearance-none rounded-full border border-primary/40 bg-transparent px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                style={{ background: "transparent" }}
              >
                Hoje
              </button>

              <p className="mt-2 text-center text-xs text-muted-foreground">
                {format(selected, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>

              <div className="mt-4 grid grid-cols-7 text-center text-xs uppercase tracking-wider text-muted-foreground">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, index) => (
                  <div key={`${d}-${index}`} className="py-2 font-medium">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((d) => {
                  const key = fmt(d);
                  const inMonth = isSameMonth(d, cursor);
                  const isSel = isSameDay(d, selected);
                  const isToday = isSameDay(d, new Date());
                  const dayItems = notesByDate.get(key) ?? [];
                  const dayStatuses = Array.from(
                    new Set(dayItems.map((item) => item.status_visita || "AGENDADA")),
                  ).slice(0, 3);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectDate(d)}
                      className={[
                        "group m-0 flex h-9 w-full appearance-none flex-col items-center justify-start gap-0.5 border-0 bg-transparent p-0 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                        inMonth ? "text-foreground" : "text-muted-foreground/35",
                      ].join(" ")}
                      style={{ background: "transparent", border: 0 }}
                    >
                      <span
                        className={[
                          "flex h-6 w-6 items-center justify-center rounded-full transition",
                          isSel
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : isToday
                              ? "text-primary"
                              : "group-hover:bg-secondary",
                        ].join(" ")}
                      >
                        {d.getDate()}
                      </span>
                      <span className="flex h-1.5 items-center justify-center gap-0.5">
                        {dayStatuses.map((status) => (
                          <span
                            key={`${key}-${status}`}
                            className={["h-1.5 w-1.5 rounded-full", statusDotClass(status)].join(" ")}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary">Visitas do dia</p>
                  <h3 className="text-xl font-bold">{format(selected, "dd/MM/yyyy")}</h3>
                </div>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                  {dayNotes.length}
                </span>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                  {error}
                </p>
              )}

              {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

              {!loading && dayNotes.length === 0 && !error && (
                <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                  Nenhuma visita nesta data.
                </p>
              )}

              <ul className="m-0 list-none space-y-3 p-0">
                {dayNotes.map((n) => (
                  <li
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedVisitOrigin(null);
                      setSelectedVisit(n);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedVisitOrigin(null);
                        setSelectedVisit(n);
                      }
                    }}
                    className="agenda-list-in group cursor-pointer rounded-xl border border-border bg-secondary/35 p-4 transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-muted/60 hover:shadow-lg hover:shadow-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                            {timeRange(n)}
                          </span>
                          <strong className="break-words text-base leading-6">{n.carteira}</strong>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "rounded-full border px-2.5 py-1 text-xs font-semibold",
                              statusClass(n.status_visita),
                            ].join(" ")}
                          >
                            {n.status_visita || "AGENDADA"}
                          </span>
                          {hasPendencias(n) && (
                            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                              Pendencia aberta
                            </span>
                          )}
                        </div>

                        {createdByLabel(n) && (
                          <p className="mt-3 text-xs font-medium text-muted-foreground">{createdByLabel(n)}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEdit(n);
                            }}
                            className="agenda-pressable rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              confirmRemove(n);
                            }}
                            className="agenda-pressable rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/20"
                          >
                            Excluir
                          </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
            <p className="text-xs uppercase tracking-widest text-primary">Cadastro</p>
            <h3 className="mt-1 text-xl font-bold leading-tight">Nova visita</h3>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              Registre uma visita nova ou selecione uma visita do dia para editar os detalhes.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="agenda-pressable mt-3 w-full rounded-md border-0 bg-primary px-4 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
            >
              Nova visita
            </button>
          </div>

          {formOpen && (
            <div className="agenda-fade-in fixed inset-0 z-[9999] flex h-[100dvh] w-full items-center justify-center overflow-hidden overscroll-none bg-background/80 px-4 py-8 backdrop-blur-sm">
              <div className="agenda-pop-in max-h-[calc(100vh-4rem)] w-full max-w-[980px] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">
                  {editing ? "Editar visita" : "Nova visita"}
                </p>
                <h3 className="mt-1 text-xl font-bold">{format(selected, "dd/MM/yyyy")}</h3>
              </div>
              {editing && (
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                  Editando
                </span>
              )}
              <button
                type="button"
                onClick={() => closeForm()}
                className="agenda-pressable rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-muted"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-2 rounded-xl border border-border bg-card/70 p-1.5 shadow-inner sm:grid-cols-4">
                {FORM_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFormTab(tab.id)}
                    className={[
                      "agenda-pressable rounded-lg border px-3 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      activeFormTab === tab.id
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-transparent bg-secondary/35 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeFormTab === "agendamento" && (
              <section className="rounded-xl border border-border bg-secondary/25 p-4">
                <p className="mb-3 text-xs uppercase tracking-widest text-primary">Agendamento</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <DateField
                      label="Data"
                      value={date}
                      isOpen={openDateField === "visita"}
                      onChange={(nextDate) => {
                        if (!nextDate) {
                          setDate("");
                          setOpenDateField(null);
                          return;
                        }
                        selectDate(toLocalDate(nextDate));
                        setOpenDateField(null);
                      }}
                      onToggle={() => {
                        setOpenTimeField(null);
                        setCarteiraOpen(false);
                        setFilterCarteiraOpen(false);
                        setExportCarteiraOpen(false);
                        setOpenSelectField(null);
                        setOpenDateField((current) => (current === "visita" ? null : "visita"));
                      }}
                    />
                  </div>

                  <TimeField
                    label="Horario de entrada"
                    value={horarioEntrada}
                    isOpen={openTimeField === "entrada"}
                    onChange={setHorarioEntrada}
                    onClose={() => setOpenTimeField(null)}
                    onToggle={() => {
                      setCarteiraOpen(false);
                      setOpenDateField(null);
                      setOpenSelectField(null);
                      setOpenTimeField((current) => (current === "entrada" ? null : "entrada"));
                    }}
                  />

                  <TimeField
                    label="Horario de saida"
                    value={horarioSaida}
                    isOpen={openTimeField === "saida"}
                    onChange={setHorarioSaida}
                    onClose={() => setOpenTimeField(null)}
                    onToggle={() => {
                      setCarteiraOpen(false);
                      setOpenDateField(null);
                      setOpenSelectField(null);
                      setOpenTimeField((current) => (current === "saida" ? null : "saida"));
                    }}
                  />

                  <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground sm:col-span-2">
                    <span>Carteira</span>
                    <input
                      data-agenda-trigger
                      value={carteira}
                      onFocus={() => {
                        setOpenTimeField(null);
                        setOpenDateField(null);
                        setFilterCarteiraOpen(false);
                        setExportCarteiraOpen(false);
                        setOpenSelectField(null);
                        setCarteiraOpen(true);
                      }}
                      onChange={(e) => {
                        setOpenTimeField(null);
                        setOpenDateField(null);
                        setOpenSelectField(null);
                        setCarteira(e.target.value);
                        setCarteiraOpen(true);
                      }}
                      placeholder="Carteira"
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      required
                    />
                    {carteiraOpen && (
                      <div
                        data-agenda-floating
                        className="agenda-pop-in absolute left-0 top-full z-[70] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                      >
                        {filteredCarteiras.length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma carteira encontrada.</p>
                        )}
                        {filteredCarteiras.map((item) => (
                          <button
                            key={`${item.id_cedente}-${item.nome_cedente}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setCarteira(item.nome_cedente);
                              setCarteiraOpen(false);
                            }}
                            className="agenda-pressable mb-1 block w-full appearance-none rounded-lg border border-border bg-secondary/35 px-3 py-2.5 text-left text-sm font-semibold text-foreground last:mb-0 hover:border-primary/60 hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            {item.nome_cedente}
                          </button>
                        ))}
                      </div>
                    )}
                  </label>

                  <label className="block space-y-1 text-sm font-semibold text-muted-foreground sm:col-span-2">
                    <span>Formato / Local</span>
                    <input
                      value={localVisita}
                      onChange={(e) => setLocalVisita(e.target.value)}
                      placeholder="Ex: Presencial, Online - Teams, Comite"
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </label>

                  <div className="sm:col-span-2">
                    <RichTextEditor
                      label="Motivo da visita"
                      value={motivoVisita}
                      onChange={setMotivoVisita}
                      placeholder="Motivo da visita"
                      minHeight="min-h-32"
                      required
                    />
                  </div>
                </div>
              </section>
              )}

              {activeFormTab === "registro" && (
              <section className="rounded-xl border border-dashed border-primary/35 bg-primary/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-widest text-primary">Registro da visita</p>
                </div>
                <div className="grid gap-3">
                  <SelectField
                    label="Status"
                    value={statusVisita}
                    options={VISIT_STATUS_OPTIONS}
                    isOpen={openSelectField === "statusVisita"}
                    onChange={(value) => {
                      setStatusVisita(value);
                      setOpenSelectField(null);
                    }}
                    onToggle={() => {
                      setOpenDateField(null);
                      setCarteiraOpen(false);
                      setOpenSelectField((current) => (current === "statusVisita" ? null : "statusVisita"));
                    }}
                  />

                  <RichTextEditor
                    label="Resumo da visita"
                    value={resumoVisita}
                    onChange={setResumoVisita}
                    placeholder="Resumo geral do que aconteceu na visita."
                  />
                  <RichTextEditor
                    label="O que foi feito"
                    value={oQueFoiFeito}
                    onChange={setOQueFoiFeito}
                    placeholder="Acoes realizadas, alinhamentos ou pontos resolvidos."
                  />

                  <div className="rounded-xl border border-border bg-card/40 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-widest text-primary">Participantes</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => addParticipante("INTERNO")}
                          className="agenda-pressable rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                        >
                          Adicionar Acme
                        </button>
                        <button
                          type="button"
                          onClick={() => addParticipante("EXTERNO")}
                          className="agenda-pressable rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                        >
                          Adicionar externo
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {participantesInternos.length === 0 && participantesExternos.length === 0 && (
                        <p className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
                          Nenhum participante adicionado.
                        </p>
                      )}

                      {[
                        { tipo: "INTERNO" as const, titulo: "Participante Acme", items: participantesInternos },
                        { tipo: "EXTERNO" as const, titulo: "Participante externo", items: participantesExternos },
                      ].map((group) =>
                        group.items.map((item, index) => (
                          <div key={`${group.tipo}-${index}`} className="rounded-xl border border-border bg-secondary/30 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <strong className="text-sm">
                                {group.titulo} {index + 1}
                              </strong>
                              <button
                                type="button"
                                onClick={() => removeParticipante(group.tipo, index)}
                                className="agenda-pressable rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-destructive-foreground hover:bg-destructive/20"
                              >
                                Remover
                              </button>
                            </div>
                            <div className="grid gap-3">
                              <label className="block space-y-1 text-sm font-semibold text-muted-foreground">
                                <span>Nome</span>
                                <input
                                  value={item.nome}
                                  onChange={(e) => updateParticipante(group.tipo, index, "nome", e.target.value)}
                                  placeholder={group.tipo === "INTERNO" ? "Nome do colaborador" : "Nome do cliente"}
                                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                              </label>
                              <label className="block space-y-1 text-sm font-semibold text-muted-foreground">
                                <span>{group.tipo === "INTERNO" ? "Area / cargo" : "Empresa / cargo"}</span>
                                <input
                                  value={item.area_cargo || ""}
                                  onChange={(e) => updateParticipante(group.tipo, index, "area_cargo", e.target.value)}
                                  placeholder={group.tipo === "INTERNO" ? "Ex: TI, Operacoes" : "Ex: Gerente, Analista"}
                                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                              </label>
                              <label className="block space-y-1 text-sm font-semibold text-muted-foreground">
                                <span>Observacao</span>
                                <textarea
                                  value={item.observacao || ""}
                                  onChange={(e) => updateParticipante(group.tipo, index, "observacao", e.target.value)}
                                  rows={2}
                                  placeholder="Detalhes adicionais desse participante."
                                  className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                              </label>
                            </div>
                          </div>
                        )),
                      )}
                    </div>
                  </div>

                </div>
              </section>
              )}

              {activeFormTab === "pendencias" && (
              <section className="rounded-xl border border-dashed border-border bg-secondary/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-widest text-primary">Pendencias e proximos passos</p>
                  <button
                    type="button"
                    onClick={addPendencia}
                    className="agenda-pressable rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    Adicionar pendencia
                  </button>
                </div>
                <div className="grid gap-3">
                  {pendencias.length === 0 && (
                    <p className="rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground">
                      Nenhuma pendencia adicionada.
                    </p>
                  )}

                  {pendencias.map((item, index) => (
                    <div key={`pendencia-form-${index}`} className="rounded-xl border border-border bg-card/50 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <strong className="text-sm">Pendencia {index + 1}</strong>
                        <button
                          type="button"
                          onClick={() => removePendencia(index)}
                          className="agenda-pressable rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-destructive-foreground hover:bg-destructive/20"
                        >
                          Remover
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <label className="block space-y-1 text-sm font-semibold text-muted-foreground">
                          <span>Pendencia</span>
                          <textarea
                            value={item.descricao}
                            onChange={(e) => updatePendencia(index, "descricao", e.target.value)}
                            rows={2}
                            placeholder="Ex: Ajustar o robo de envio"
                            className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </label>
                        <label className="block space-y-1 text-sm font-semibold text-muted-foreground">
                          <span>Responsavel</span>
                          <input
                            value={item.responsavel || ""}
                            onChange={(e) => updatePendencia(index, "responsavel", e.target.value)}
                            placeholder="Ex: DEV, CRM, Operacoes"
                            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </label>
                        <label className="block space-y-1 text-sm font-semibold text-muted-foreground">
                          <span>Observacao</span>
                          <textarea
                            value={item.observacao || ""}
                            onChange={(e) => updatePendencia(index, "observacao", e.target.value)}
                            rows={2}
                            placeholder="Detalhes adicionais dessa pendencia."
                            className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                </div>
              </section>
              )}

              {activeFormTab === "observacoes" && (
              <section className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="mb-3 text-xs uppercase tracking-widest text-primary">Observacoes gerais</p>
                <RichTextEditor
                  label="Observacoes da visita"
                  value={observacoes}
                  onChange={setObservacoes}
                  placeholder="Detalhes adicionais da visita."
                />
              </section>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="agenda-pressable flex-1 rounded-md border-0 bg-primary px-4 py-2 text-sm font-semibold text-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
                >
                  {editing ? "Salvar alteracoes" : "Adicionar"}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => closeForm()}
                    className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
              </div>
            </div>
          )}

          {formDiscardConfirmOpen && (
            <div className="agenda-fade-in fixed inset-0 z-[10000] flex h-[100dvh] w-screen items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
              <div className="agenda-pop-in w-full max-w-[440px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <p className="text-xs uppercase tracking-widest text-primary">Alteracoes nao salvas</p>
                <h3 className="mt-2 text-xl font-bold">Descartar registro?</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Existem informacoes preenchidas que ainda nao foram salvas. Se fechar agora, essas alteracoes serao
                  perdidas.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFormDiscardConfirmOpen(false)}
                    className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    Continuar editando
                  </button>
                  <button
                    type="button"
                    onClick={() => closeForm(true)}
                    className="agenda-pressable rounded-md border border-primary/50 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedVisit && (
            <div className="agenda-fade-in fixed inset-0 z-[9999] flex h-[100dvh] w-full items-center justify-center overflow-hidden overscroll-none bg-background/80 px-4 py-8 backdrop-blur-sm">
              <div className="agenda-pop-in max-h-[calc(100vh-4rem)] w-full max-w-[900px] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {selectedVisitOrigin === "filters" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVisit(null);
                          setFilterResultsOpen(true);
                        }}
                        className="agenda-pressable mb-2 inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-bold text-foreground shadow-sm hover:border-primary/50 hover:bg-muted"
                      >
                        Voltar
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold">Detalhes da visita</h3>
                      <span
                        className={[
                          "rounded-md border px-3 py-1 text-sm font-semibold",
                          statusClass(selectedVisit.status_visita),
                        ].join(" ")}
                      >
                        {selectedVisit.status_visita || "AGENDADA"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(selectedVisit)}
                      className="agenda-pressable rounded-md border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmRemove(selectedVisit)}
                      className="agenda-pressable rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/20"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVisitOrigin(null);
                        setSelectedVisit(null);
                      }}
                      className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {hasPendencias(selectedVisit) && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm font-semibold text-amber-200">
                      Esta visita possui {getPendenciasAbertas(selectedVisit).length} pendencia(s) em aberto.
                    </div>
                  )}

                  <section className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="mb-4 text-xs uppercase tracking-widest text-primary">Agendamento</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Data</span>
                        <strong className="mt-1 block text-sm">{formatDateBR(selectedVisit.date)}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Entrada</span>
                        <strong className="mt-1 block text-sm">{(selectedVisit.horario_entrada || "").slice(0, 5)}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Saida</span>
                        <strong className="mt-1 block text-sm">{(selectedVisit.horario_saida || "").slice(0, 5)}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Carteira</span>
                        <strong className="mt-1 block break-words text-sm">{selectedVisit.carteira || "-"}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Formato / Local</span>
                        <strong className="mt-1 block break-words text-sm">{selectedVisit.local_visita || "-"}</strong>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs text-muted-foreground">Motivo da visita</span>
                      <RichTextContent value={selectedVisit.motivo_visita} className="mt-1 text-sm leading-6" />
                    </div>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-border bg-secondary/20 p-4">
                      <p className="mb-3 text-xs uppercase tracking-widest text-primary">Registro da visita</p>
                      <div className="space-y-3 text-sm leading-6">
                        <div>
                          <span className="text-xs text-muted-foreground">Resumo da visita</span>
                          <RichTextContent value={selectedVisit.resumo_visita} className="mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">O que foi feito</span>
                          <RichTextContent value={selectedVisit.o_que_foi_feito} className="mt-1" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-secondary/20 p-4">
                      <p className="mb-3 text-xs uppercase tracking-widest text-primary">Pendencias e acompanhamento</p>
                      <div className="space-y-3 text-sm leading-6">
                        {getPendencias(selectedVisit).length === 0 && <p className="text-muted-foreground">-</p>}
                        {getPendencias(selectedVisit).map((item, index) => (
                          <div
                            key={`detail-pendencia-${item.id || index}`}
                            className={[
                              "rounded-lg border p-3",
                              isPendenciaAberta(item)
                                ? "border-amber-400/35 bg-amber-500/10"
                                : "border-emerald-400/30 bg-emerald-500/10",
                            ].join(" ")}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <span className="text-xs text-muted-foreground">Pendencia {index + 1}</span>
                                <p className="mt-1 whitespace-pre-wrap font-semibold">{item.descricao}</p>
                              </div>
                              <span
                                className={[
                                  "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  isPendenciaAberta(item)
                                    ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                                    : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
                                ].join(" ")}
                              >
                                {isPendenciaAberta(item) ? "Pendente" : "Resolvida"}
                              </span>
                            </div>
                            {item.responsavel && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Responsavel: <span className="font-semibold text-foreground">{item.responsavel}</span>
                              </p>
                            )}
                            {item.observacao && (
                              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.observacao}</p>
                            )}
                            {!isPendenciaAberta(item) && (
                              <p className="mt-3 text-xs text-emerald-200">
                                Resolvida por{" "}
                                <span className="font-semibold">{item.login_resolucao || "-"}</span>
                                {item.data_resolucao ? ` em ${formatDateTimeBR(item.data_resolucao)}` : ""}.
                              </p>
                            )}
                            {isPendenciaAberta(item) && item.id && (
                              <button
                                type="button"
                                onClick={() => resolvePendencia(selectedVisit, item)}
                                disabled={resolvingPendenciaId === item.id}
                                className="agenda-pressable mt-3 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {resolvingPendenciaId === item.id ? "Marcando..." : "Marcar como resolvida"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="mb-3 text-xs uppercase tracking-widest text-primary">Participantes</p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {[
                        { tipo: "INTERNO" as const, titulo: "Acme" },
                        { tipo: "EXTERNO" as const, titulo: "Externos" },
                      ].map((group) => {
                        const items = getParticipantes(selectedVisit, group.tipo);
                        return (
                          <div key={`detail-${group.tipo}`} className="rounded-lg border border-border bg-card/50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              {group.titulo}
                            </p>
                            {items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">-</p>}
                            <div className="mt-2 space-y-2">
                              {items.map((item, index) => (
                                <div key={`detail-participante-${group.tipo}-${index}`} className="text-sm leading-6">
                                  <p className="font-semibold">{item.nome}</p>
                                  {item.area_cargo && <p className="text-xs text-muted-foreground">{item.area_cargo}</p>}
                                  {item.observacao && (
                                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                      {item.observacao}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="mb-3 text-xs uppercase tracking-widest text-primary">Observacoes</p>
                    <RichTextContent value={selectedVisit.observacoes} className="text-sm leading-6 text-muted-foreground" />
                  </section>

                  <section className="rounded-xl border border-border bg-card/40 px-4 py-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Historico</p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Criada por{" "}
                        <strong className="font-semibold text-foreground">
                          {auditUserLabel(selectedVisit.nome_criacao, selectedVisit.login_criacao)}
                        </strong>
                        {selectedVisit.created_at ? ` em ${formatDateTimeBR(selectedVisit.created_at)}` : ""}.
                      </span>
                      {selectedVisit.updated_at && (
                        <span>
                          Atualizada por{" "}
                          <strong className="font-semibold text-foreground">
                            {auditUserLabel(null, selectedVisit.login_atualizacao)}
                          </strong>{" "}
                          em {formatDateTimeBR(selectedVisit.updated_at)}.
                        </span>
                      )}
                      {selectedVisit.data_envio_ata && (
                        <span>
                          ATA enviada para diretoria/gerencia por{" "}
                          <strong className="font-semibold text-foreground">
                            {auditUserLabel(null, selectedVisit.login_envio_ata)}
                          </strong>{" "}
                          em {formatDateTimeBR(selectedVisit.data_envio_ata)}.
                        </span>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {deleteTarget && (
            <div className="agenda-fade-in fixed inset-0 z-[10000] flex h-[100dvh] w-screen items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
              <div className="agenda-pop-in w-full max-w-[420px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <p className="text-xs uppercase tracking-widest text-destructive-foreground">Excluir visita</p>
                <h3 className="mt-2 text-xl font-bold">Confirmar exclusao?</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Esta visita de <span className="font-semibold text-foreground">{deleteTarget.carteira}</span> em{" "}
                  <span className="font-semibold text-foreground">{formatDateBR(deleteTarget.date)}</span> sera removida
                  da agenda.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    className="agenda-pressable rounded-md border border-destructive/40 bg-destructive/20 px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/30"
                  >
                    Excluir visita
                  </button>
                </div>
              </div>
            </div>
          )}

          {filterResultsOpen && (
            <div className="agenda-fade-in fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm">
              <div className="agenda-pop-in max-h-[calc(100vh-4rem)] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">Resultado dos filtros</p>
                    <h3 className="mt-1 text-xl font-bold">{filteredNotes.length} visita(s) encontrada(s)</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="agenda-pressable rounded-md border-0 bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
                    >
                      Limpar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterResultsOpen(false)}
                      className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {filteredNotes.length === 0 && (
                  <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    Nenhuma visita encontrada para os filtros selecionados.
                  </p>
                )}

                <ul className="m-0 max-h-[65vh] list-none space-y-3 overflow-y-auto p-0 pr-1">
                  {filteredNotes.map((note) => (
                    <li
                      key={`filter-result-${note.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setFilterResultsOpen(false);
                        setSelectedVisitOrigin("filters");
                        setSelectedVisit(note);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setFilterResultsOpen(false);
                          setSelectedVisitOrigin("filters");
                          setSelectedVisit(note);
                        }
                      }}
                      className="agenda-list-in group cursor-pointer rounded-xl border border-border bg-secondary/35 p-4 transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-muted/60 hover:shadow-lg hover:shadow-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                          {formatDateBR(note.date)}
                        </span>
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                          {timeRange(note)}
                        </span>
                        <strong className="break-words text-base leading-6">{note.carteira}</strong>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-xs font-semibold",
                            statusClass(note.status_visita),
                          ].join(" ")}
                        >
                          {note.status_visita || "AGENDADA"}
                        </span>
                        {hasPendencias(note) && (
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            Pendencia aberta
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {pendingOpen && (
            <div className="agenda-fade-in fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm">
              <div className="agenda-pop-in max-h-[calc(100vh-4rem)] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">Acompanhamento</p>
                    <h3 className="mt-1 text-xl font-bold">Proximas agendas</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingOpen(false)}
                    className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    Fechar
                  </button>
                </div>

                <div className="space-y-3">
                  {scheduledVisits.map((note) => (
                    <button
                      key={`scheduled-${note.id}`}
                      type="button"
                      onClick={() => {
                        setPendingOpen(false);
                        setSelectedVisitOrigin(null);
                        setSelectedVisit(note);
                      }}
                      className="agenda-pressable agenda-list-in block w-full rounded-xl border border-border bg-secondary/25 p-4 text-left hover:border-primary/60 hover:bg-muted/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                          {formatDateBR(note.date)}
                        </span>
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                          {timeRange(note)}
                        </span>
                        <strong className="text-sm text-foreground">{note.carteira}</strong>
                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-xs font-semibold",
                            statusClass(note.status_visita),
                          ].join(" ")}
                        >
                          {note.status_visita || "AGENDADA"}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {richTextToPlainText(note.motivo_visita) || "Sem motivo informado"}
                      </p>
                      {note.local_visita && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Local / formato: <span className="font-semibold text-foreground">{note.local_visita}</span>
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {openPendenciasOpen && (
            <div className="agenda-fade-in fixed inset-0 z-[9999] flex h-[100dvh] w-full items-center justify-center overflow-hidden overscroll-none bg-background/80 px-4 py-8 backdrop-blur-sm">
              <div className="agenda-pop-in max-h-[calc(100vh-4rem)] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">Acompanhamento</p>
                    <h3 className="mt-1 text-xl font-bold">Pendencias abertas</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Itens pendentes das agendas criadas por voce.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenPendenciasOpen(false)}
                    className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    Fechar
                  </button>
                </div>

                <div className="space-y-3">
                  {openPendencias.length === 0 && (
                    <p className="rounded-xl border border-border bg-secondary/35 p-4 text-sm text-muted-foreground">
                      Nenhuma pendencia aberta para o seu usuario.
                    </p>
                  )}
                  {openPendencias.map((pendencia) => {
                    const note = notes.find((item) => String(item.id) === String(pendencia.agenda_id));
                    return (
                      <button
                        key={`open-pendencia-${pendencia.id}`}
                        type="button"
                        onClick={() => {
                          setOpenPendenciasOpen(false);
                          if (note) {
                            setSelectedVisitOrigin(null);
                            setSelectedVisit(note);
                          }
                        }}
                        className="agenda-pressable agenda-list-in block w-full rounded-xl border border-border bg-secondary/25 p-4 text-left hover:border-primary/60 hover:bg-muted/60"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                            {formatDateBR(pendencia.date)}
                          </span>
                          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                            {(pendencia.horario_entrada || "").slice(0, 5)}
                          </span>
                          <strong className="text-sm text-foreground">{pendencia.carteira}</strong>
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            Pendente
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground">
                          {pendencia.descricao}
                        </p>
                        {pendencia.responsavel && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Responsavel: <span className="font-semibold text-foreground">{pendencia.responsavel}</span>
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
            <p className="text-xs uppercase tracking-widest text-primary">Relatorios</p>
            <h3 className="mt-1 text-xl font-bold leading-tight">Exportar visitas</h3>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              Gere um PDF filtrando por periodo, carteira e status da visita.
            </p>
            <button
              type="button"
              onClick={() => {
                setExportMessage(null);
                setAtaPreviewMessage(null);
                setAtaPreviewOpen(false);
                setAtaSendConfirmOpen(false);
                setAtaSendOptionsOpen(false);
                setAtaManualRecipientsOpen(false);
                setAtaRecipientsError(null);
                setAtaSendMode("default");
                setAtaRecipientsText("");
                setSelectedAtaVisit(null);
                setAtaAttachments([]);
                setAtaPdfBlob(null);
                setOpenDateField(null);
                setExportCarteiraOpen(false);
                setAtaCarteiraOpen(false);
                setOpenSelectField(null);
                setExportOpen(true);
              }}
              className="agenda-pressable mt-3 w-full rounded-md border-0 bg-primary px-4 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
            >
              Exportar visitas
            </button>
          </div>

          {exportOpen && (
            <div
              className={[
                "fixed inset-0 z-[9999] flex h-[100dvh] w-full items-start justify-center bg-background/80 px-4 py-8 backdrop-blur-sm",
                ataSendOptionsOpen || ataManualRecipientsOpen || ataSendConfirmOpen ? "overflow-hidden" : "overflow-y-auto",
              ].join(" ")}
            >
              <div className="w-full max-w-[820px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">Exportar visitas</p>
                    <h3 className="mt-1 text-xl font-bold">Ata ou Relatorio</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Escolha entre gerar uma ata de uma visita especifica ou exportar um relatorio por periodo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      setAtaPreviewOpen(false);
                      setAtaSendConfirmOpen(false);
                      setAtaSendOptionsOpen(false);
                      setAtaManualRecipientsOpen(false);
                      setAtaRecipientsError(null);
                      setAtaSendMode("default");
                      setAtaRecipientsText("");
                      setSelectedAtaVisit(null);
                      setAtaPreviewMessage(null);
                      setAtaAttachments([]);
                      setAtaPdfBlob(null);
                      setOpenDateField(null);
                      setExportCarteiraOpen(false);
                      setAtaCarteiraOpen(false);
                      setOpenSelectField(null);
                    }}
                    className="agenda-pressable rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid gap-2 rounded-xl border border-border bg-card/70 p-1.5 shadow-inner sm:grid-cols-2">
                  {EXPORT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setExportTab(tab.id);
                        setExportMessage(null);
                        setAtaPreviewMessage(null);
                        setAtaPreviewOpen(false);
                        setAtaSendConfirmOpen(false);
                        setAtaSendOptionsOpen(false);
                        setAtaManualRecipientsOpen(false);
                        setAtaRecipientsError(null);
                        setAtaSendMode("default");
                        setAtaRecipientsText("");
                        setAtaAttachments([]);
                        setAtaPdfBlob(null);
                        setOpenDateField(null);
                        setOpenSelectField(null);
                        setExportCarteiraOpen(false);
                        setAtaCarteiraOpen(false);
                      }}
                      className={[
                        "agenda-pressable rounded-lg border px-3 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                        exportTab === tab.id
                          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "border-transparent bg-secondary/35 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {exportTab === "ata" && (
                  ataPreviewOpen && selectedAtaVisit ? (
                  <div className="mt-5 rounded-xl border border-border bg-secondary/15 p-4">
                    <button
                      data-no-print
                      type="button"
                      onClick={() => setAtaPreviewOpen(false)}
                      className="agenda-pressable mb-4 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Voltar
                    </button>

                    <div
                      ref={ataPrintRef}
                      data-ata-print
                      className="mx-auto w-[186mm] max-w-full rounded-sm bg-white p-10 text-slate-950 shadow-2xl"
                    >
                      <header className="border-b-2 border-slate-900 pb-6">
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-2">
                              <img src={acmeIcon} alt="" className="h-5 w-auto" />
                              <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-600">Grupo Acme</p>
                            </div>
                            <h4 className="mt-2 text-2xl font-black uppercase tracking-wide">Ata de reuniao</h4>
                            <p className="mt-1 text-sm text-slate-500">Agenda de visitas - Atlas</p>
                          </div>
                          <div className="text-right text-xs leading-5 text-slate-500">
                            <p className="font-bold uppercase text-slate-800">Documento</p>
                            <p>ATA-{String(selectedAtaVisit.id).padStart(5, "0")}</p>
                            <p>Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                          </div>
                        </div>
                      </header>

                      <main className="space-y-7 pt-7 text-sm leading-6">
                        <section data-ata-section>
                          <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                            Identificacao da reuniao
                          </h5>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Cliente / Carteira</span>
                              <p className="mt-1 font-bold text-slate-950">{selectedAtaVisit.carteira || "-"}</p>
                            </div>
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Data</span>
                              <p className="mt-1 font-bold text-slate-950">{formatDateBR(selectedAtaVisit.date)}</p>
                            </div>
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Horario</span>
                              <p className="mt-1 font-bold text-slate-950">{timeRange(selectedAtaVisit) || "-"}</p>
                            </div>
                            {selectedAtaVisit.local_visita?.trim() && (
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Local / Formato</span>
                                <p className="mt-1 font-bold text-slate-950">{selectedAtaVisit.local_visita}</p>
                              </div>
                            )}
                            {createdByName(selectedAtaVisit) && (
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Responsavel pelo registro</span>
                                <p className="mt-1 font-bold text-slate-950">{createdByName(selectedAtaVisit)}</p>
                              </div>
                            )}
                          </div>
                        </section>

                        <section data-ata-section>
                          <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                            Pauta
                          </h5>
                          <RichTextContent value={selectedAtaVisit.motivo_visita} className="mt-4 text-slate-800" />
                        </section>

                        {hasSelectedAtaParticipantes && (
                          <section data-ata-section>
                            <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                              Participantes
                            </h5>
                            <div data-ata-participants className="mt-4 grid grid-cols-2 gap-5">
                              {[
                                { titulo: "Representantes Acme", items: selectedAtaParticipantesInternos },
                                { titulo: "Representantes externos", items: selectedAtaParticipantesExternos },
                              ]
                                .filter((group) => group.items.length > 0)
                                .map((group) => (
                                  <div key={`ata-preview-${group.titulo}`}>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">{group.titulo}</p>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-800">
                                      {group.items.map((item, index) => (
                                        <li key={`ata-preview-participante-${group.titulo}-${index}`}>
                                          <span className="font-semibold">{item.nome}</span>
                                          {item.area_cargo && <span className="text-slate-600"> ({item.area_cargo})</span>}
                                          {item.observacao && (
                                            <p className="mt-1 whitespace-pre-wrap text-slate-600">{item.observacao}</p>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                            </div>
                          </section>
                        )}

                        {hasSelectedAtaResumo && (
                          <section data-ata-section>
                            <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                              Registro das discussoes
                            </h5>
                            <RichTextContent value={selectedAtaVisit.resumo_visita} className="mt-4 text-slate-800" />
                          </section>
                        )}

                        {hasSelectedAtaFeito && (
                          <section data-ata-section>
                            <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                              Deliberacoes e decisoes
                            </h5>
                            <RichTextContent value={selectedAtaVisit.o_que_foi_feito} className="mt-4 text-slate-800" />
                          </section>
                        )}

                        {selectedAtaPendencias.length > 0 && (
                          <section data-ata-section>
                            <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                              Encaminhamentos e pendencias
                            </h5>
                            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                              <div className="grid grid-cols-[1.35fr_1.1fr_1.55fr] bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600">
                                <span>Pendencia</span>
                                <span className="px-4 text-center">Responsavel</span>
                                <span>Observacao</span>
                              </div>
                              {selectedAtaPendencias.map((item, index) => (
                                <div
                                  key={`ata-preview-pendencia-${index}`}
                                  className="grid grid-cols-[1.35fr_1.1fr_1.55fr] border-t border-slate-200 px-3 py-2 text-xs leading-5 text-slate-800"
                                >
                                  <span className="whitespace-pre-wrap font-semibold">{item.descricao}</span>
                                  <span className="whitespace-pre-wrap px-4 text-center">{item.responsavel || "-"}</span>
                                  <span className="whitespace-pre-wrap">{item.observacao || "-"}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {hasSelectedAtaObservacoes && (
                          <section data-ata-section>
                            <h5 data-ata-section-title className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                              Observacoes finais
                            </h5>
                            <RichTextContent value={selectedAtaVisit.observacoes} className="mt-4 text-slate-800" />
                          </section>
                        )}

                      </main>

                      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
                        Documento gerado pelo Atlas em {format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}.
                      </footer>
                    </div>

                    <div data-no-print className="mx-auto mt-3 w-[186mm] max-w-full rounded-lg border border-border bg-secondary/10 px-3 py-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-widest text-primary">Anexos complementares</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                            Opcional. Arquivos adicionais para acompanhar a ATA.
                          </p>
                        </div>
                        <label className="agenda-pressable inline-flex cursor-pointer items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white">
                          Selecionar arquivos
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              addAtaAttachments(event.target.files);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {ataAttachments.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {ataAttachments.map((file, index) => (
                            <li
                              key={`ata-attachment-${file.name}-${file.size}-${index}`}
                              className="flex flex-col gap-1.5 rounded-md border border-border bg-card/50 px-2.5 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-foreground">{file.name}</span>
                                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAtaAttachment(index)}
                                className="agenda-pressable rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/20"
                              >
                                Remover
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div data-no-print className="mx-auto mt-4 flex w-[186mm] max-w-full flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={downloadAtaPdf}
                        disabled={ataDownloading || ataPdfPreparing}
                        className="agenda-pressable flex-1 rounded-md border-0 bg-primary px-4 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ataDownloading || ataPdfPreparing ? "Preparando..." : "Baixar PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAtaRecipientsError(null);
                          setAtaSendOptionsOpen(true);
                        }}
                        disabled={ataSending || ataPdfPreparing}
                        className="agenda-pressable flex-1 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ataPdfPreparing ? "Preparando PDF..." : ataSending ? "Enviando..." : "Enviar"}
                      </button>
                    </div>
                    {ataPreviewMessage && (
                      <p data-no-print className="mx-auto mt-3 w-[186mm] max-w-full rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                        {ataPreviewMessage}
                      </p>
                    )}
                    {ataPdfPreparing && !ataPreviewMessage && (
                      <p data-no-print className="mx-auto mt-3 w-[186mm] max-w-full rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                        Preparando PDF...
                      </p>
                    )}
                  </div>
                  ) : (
                  <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
                    <section className="rounded-xl border border-border bg-secondary/20 p-4">
                      <p className="mb-3 text-xs uppercase tracking-widest text-primary">Filtros da ata</p>
                      <div className="grid gap-3">
                        <MonthField
                          label="Mes"
                          value={ataMes}
                          isOpen={openDateField === "ataMes"}
                          onChange={(value) => {
                            setAtaMes(value);
                            setOpenDateField(null);
                          }}
                          onToggle={() => {
                            setOpenTimeField(null);
                            setOpenSelectField(null);
                            setExportCarteiraOpen(false);
                            setAtaCarteiraOpen(false);
                            setOpenDateField((current) => (current === "ataMes" ? null : "ataMes"));
                          }}
                        />

                        <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground">
                          <span>Carteira</span>
                          <input
                            data-agenda-trigger
                            value={ataCarteira}
                            onFocus={() => {
                              setOpenDateField(null);
                              setOpenSelectField(null);
                              setExportCarteiraOpen(false);
                              setAtaCarteiraOpen(true);
                            }}
                            onChange={(e) => {
                              setOpenDateField(null);
                              setOpenSelectField(null);
                              setAtaCarteira(e.target.value);
                              setAtaCarteiraOpen(true);
                            }}
                            placeholder="Todas as carteiras"
                            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                          {ataCarteiraOpen && (
                            <div
                              data-agenda-floating
                              className="agenda-pop-in absolute left-0 top-full z-[70] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                            >
                              {filteredAtaCarteiras.length === 0 && (
                                <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma carteira encontrada.</p>
                              )}
                              {filteredAtaCarteiras.map((item) => (
                                <button
                                  key={`ata-${item.id_cedente}-${item.nome_cedente}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setAtaCarteira(item.nome_cedente);
                                    setAtaCarteiraOpen(false);
                                  }}
                                  className="agenda-pressable mb-1 block w-full appearance-none rounded-lg border border-border bg-secondary/35 px-3 py-2.5 text-left text-sm font-semibold text-white last:mb-0 hover:border-primary/60 hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                >
                                  {item.nome_cedente}
                                </button>
                              ))}
                            </div>
                          )}
                        </label>

                        <SelectField
                          label="Status"
                          value={ataStatus}
                          options={STATUS_FILTER_OPTIONS}
                          isOpen={openSelectField === "ataStatus"}
                          onChange={(value) => {
                            setAtaStatus(value);
                            setOpenSelectField(null);
                          }}
                          onToggle={() => {
                            setOpenDateField(null);
                            setAtaCarteiraOpen(false);
                            setExportCarteiraOpen(false);
                            setOpenSelectField((current) => (current === "ataStatus" ? null : "ataStatus"));
                          }}
                        />
                      </div>
                    </section>

                    <section className="rounded-xl border border-border bg-secondary/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-primary">Visitas encontradas</p>
                          <h4 className="mt-1 text-lg font-bold">{ataVisits.length} registro(s)</h4>
                        </div>
                        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                          Selecione uma visita
                        </span>
                      </div>

                      {ataVisits.length === 0 && (
                        <p className="rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
                          Nenhuma visita encontrada para gerar ata.
                        </p>
                      )}

                      <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
                        {ataVisits.map((note) => {
                          const isSelected = selectedAtaVisit?.id === note.id;
                          return (
                            <button
                              key={`ata-visit-${note.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedAtaVisit(note);
                                setAtaPreviewMessage(null);
                                setAtaAttachments([]);
                                setAtaPdfBlob(null);
                              }}
                              className={[
                                "agenda-pressable block w-full rounded-xl border p-3 text-left hover:border-primary/60 hover:bg-muted/60",
                                isSelected ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-border bg-card/55",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                                  {formatDateBR(note.date)}
                                </span>
                                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                                  {timeRange(note)}
                                </span>
                                <span
                                  className={[
                                    "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                    statusClass(note.status_visita),
                                  ].join(" ")}
                                >
                                  {note.status_visita || "AGENDADA"}
                                </span>
                              </div>
                              <strong className="mt-2 block break-words text-sm leading-6 text-foreground">
                                {note.carteira}
                              </strong>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {richTextToPlainText(note.motivo_visita) || "Sem motivo informado"}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {ataPreviewMessage && (
                        <p className="mt-3 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                          {ataPreviewMessage}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={!selectedAtaVisit}
                        onClick={() => setAtaPreviewOpen(true)}
                        className="agenda-pressable mt-4 w-full rounded-md border-0 bg-primary px-4 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none"
                      >
                        Pre-visualizar ATA
                      </button>
                    </section>
                  </div>
                  )
                )}

                {exportTab === "relatorio" && (
                  <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="mb-3 text-xs uppercase tracking-widest text-primary">Filtros do relatorio</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DateField
                        label="Data inicial"
                        value={exportInicio}
                        isOpen={openDateField === "exportInicio"}
                        onChange={(nextDate) => {
                          setExportInicio(nextDate);
                          setOpenDateField(null);
                        }}
                        onToggle={() => {
                          setOpenTimeField(null);
                          setCarteiraOpen(false);
                          setFilterCarteiraOpen(false);
                          setAtaCarteiraOpen(false);
                          setExportCarteiraOpen(false);
                          setOpenSelectField(null);
                          setOpenDateField((current) => (current === "exportInicio" ? null : "exportInicio"));
                        }}
                      />
                      <DateField
                        label="Data final"
                        value={exportFim}
                        isOpen={openDateField === "exportFim"}
                        onChange={(nextDate) => {
                          setExportFim(nextDate);
                          setOpenDateField(null);
                        }}
                        onToggle={() => {
                          setOpenTimeField(null);
                          setCarteiraOpen(false);
                          setFilterCarteiraOpen(false);
                          setAtaCarteiraOpen(false);
                          setExportCarteiraOpen(false);
                          setOpenSelectField(null);
                          setOpenDateField((current) => (current === "exportFim" ? null : "exportFim"));
                        }}
                      />
                      <label className="relative block space-y-1 text-sm font-semibold text-muted-foreground sm:col-span-2">
                        <span>Carteira</span>
                        <input
                          data-agenda-trigger
                          value={exportCarteira}
                          onFocus={() => {
                            setOpenDateField(null);
                            setFilterCarteiraOpen(false);
                            setAtaCarteiraOpen(false);
                            setOpenSelectField(null);
                            setExportCarteiraOpen(true);
                          }}
                          onChange={(e) => {
                            setOpenDateField(null);
                            setFilterCarteiraOpen(false);
                            setAtaCarteiraOpen(false);
                            setOpenSelectField(null);
                            setExportCarteira(e.target.value);
                            setExportCarteiraOpen(true);
                          }}
                          placeholder="Todas as carteiras"
                          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        {exportCarteiraOpen && (
                          <div
                            data-agenda-floating
                            className="agenda-pop-in absolute left-0 top-full z-[70] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                          >
                            {filteredExportCarteiras.length === 0 && (
                              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma carteira encontrada.</p>
                            )}
                            {filteredExportCarteiras.map((item) => (
                              <button
                                key={`export-${item.id_cedente}-${item.nome_cedente}`}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setExportCarteira(item.nome_cedente);
                                  setExportCarteiraOpen(false);
                                }}
                                className="agenda-pressable mb-1 block w-full appearance-none rounded-lg border border-border bg-secondary/35 px-3 py-2.5 text-left text-sm font-semibold text-foreground last:mb-0 hover:border-primary/60 hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              >
                                {item.nome_cedente}
                              </button>
                            ))}
                          </div>
                        )}
                      </label>
                      <div className="sm:col-span-2">
                        <SelectField
                          label="Status"
                          value={exportStatus}
                          options={STATUS_FILTER_OPTIONS}
                          isOpen={openSelectField === "exportStatus"}
                          onChange={(value) => {
                            setExportStatus(value);
                            setOpenSelectField(null);
                          }}
                          onToggle={() => {
                            setOpenDateField(null);
                            setAtaCarteiraOpen(false);
                            setExportCarteiraOpen(false);
                            setOpenSelectField((current) => (current === "exportStatus" ? null : "exportStatus"));
                          }}
                        />
                      </div>
                    </div>

                    {exportMessage && (
                      <p className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                        {exportMessage}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={exportVisits}
                      disabled={reportDownloading}
                      className="agenda-pressable mt-5 w-full rounded-md border-0 bg-primary px-4 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reportDownloading ? "Gerando PDF..." : "Baixar PDF"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
            <p className="text-xs uppercase tracking-widest text-primary">Acompanhamento</p>
            <div className="mt-4 space-y-3">
              {openPendencias.length > 0 && (
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenPendenciasOpen(true)}
                    className="agenda-pressable flex w-full appearance-none items-start justify-between gap-4 border-0 bg-transparent p-0 text-left"
                    style={{ background: "transparent", border: 0 }}
                  >
                    <div>
                      <span className="text-xs text-amber-200">Pendencias abertas</span>
                      <strong className="mt-1 block text-2xl text-foreground">{openPendencias.length}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Itens de agendas criadas por voce
                      </span>
                    </div>
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                      Verificar
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenPendenciasOpen(true)}
                    className="agenda-pressable mt-3 block w-full rounded-lg border border-border bg-card/60 px-3 py-2.5 text-left text-xs text-muted-foreground hover:border-primary/50 hover:bg-muted/60"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{openPendencias[0].carteira}</span>
                      <span className="shrink-0 text-muted-foreground">{formatDateBR(openPendencias[0].date)}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm">{openPendencias[0].descricao}</span>
                    {openPendencias.length > 1 && (
                      <span className="mt-1 block text-xs font-semibold text-primary">
                        +{openPendencias.length - 1} pendencia(s)
                      </span>
                    )}
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <button
                  type="button"
                  onClick={() => scheduledNotes > 0 && setPendingOpen(true)}
                  className="agenda-pressable flex w-full appearance-none items-start justify-between gap-4 border-0 bg-transparent p-0 text-left"
                  style={{ background: "transparent", border: 0 }}
                >
                  <div>
                    <span className="text-xs text-muted-foreground">Proximas agendas no mes</span>
                    <strong className="mt-1 block text-2xl text-foreground">{scheduledNotes}</strong>
                  </div>
                  {scheduledNotes > 0 && (
                    <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                      Verificar
                    </span>
                  )}
                </button>

                {scheduledNotes > 0 && (
                  <div className="mt-4 space-y-2">
                    {scheduledVisits.slice(0, 2).map((note) => (
                      <button
                        key={`scheduled-preview-${note.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedVisitOrigin(null);
                          setSelectedVisit(note);
                        }}
                        className="agenda-pressable agenda-list-in block w-full rounded-lg border border-border bg-card/60 px-3 py-2.5 text-left text-xs text-muted-foreground hover:border-primary/50 hover:bg-muted/60"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-foreground">{note.carteira}</span>
                          <span className="shrink-0 text-muted-foreground">{formatDateBR(note.date)}</span>
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-primary">{timeRange(note)}</span>
                        <span className="mt-1 block truncate text-sm">{richTextToPlainText(note.motivo_visita) || "Sem motivo informado"}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPendingOpen(true)}
                      className="agenda-pressable mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      Ver todas
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {ataSendOptionsOpen && selectedAtaVisit && (
        <div
          data-no-print
          className="agenda-fade-in fixed inset-0 z-[2147483647] flex h-[100dvh] w-full touch-none items-center justify-center overflow-hidden overscroll-none bg-background/90 px-4 backdrop-blur-md"
        >
          <div className="agenda-pop-in w-full max-w-[520px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-primary">Enviar ata</p>
            <h3 className="mt-2 text-xl font-bold">Como deseja enviar?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Escolha se a ATA sera enviada para a lista padrao da gerencia/diretoria ou para destinatarios informados manualmente.
            </p>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setAtaSendMode("default");
                  setAtaSendOptionsOpen(false);
                  setAtaSendConfirmOpen(true);
                }}
                className="agenda-pressable rounded-xl border border-primary/40 bg-primary/10 p-4 text-left hover:bg-primary/20"
              >
                <strong className="block text-sm text-foreground">Enviar para gerencia/diretoria</strong>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Usa a lista padrao configurada no Atlas.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAtaSendMode("manual");
                  setAtaRecipientsError(null);
                  setAtaSendOptionsOpen(false);
                  setAtaManualRecipientsOpen(true);
                }}
                className="agenda-pressable rounded-xl border border-border bg-secondary/35 p-4 text-left hover:border-primary/50 hover:bg-muted"
              >
                <strong className="block text-sm text-foreground">Escolher destinatarios</strong>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Informe os e-mails que devem receber esta ATA.
                </span>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setAtaSendOptionsOpen(false)}
                className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {ataManualRecipientsOpen && selectedAtaVisit && (
        <div
          data-no-print
          className="agenda-fade-in fixed inset-0 z-[2147483647] flex h-[100dvh] w-full touch-none items-center justify-center overflow-hidden overscroll-none bg-background/90 px-4 backdrop-blur-md"
        >
          <div className="agenda-pop-in w-full max-w-[560px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-primary">Destinatarios</p>
            <h3 className="mt-2 text-xl font-bold">Escolher destinatarios</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Separe os e-mails por virgula, ponto e virgula, espaco ou quebra de linha.
            </p>

            <label className="mt-4 block space-y-1 text-sm font-semibold text-muted-foreground">
              <span>E-mails</span>
              <textarea
                value={ataRecipientsText}
                onChange={(event) => {
                  setAtaRecipientsText(event.target.value);
                  setAtaRecipientsError(null);
                }}
                rows={4}
                placeholder="email1@empresa.com.br; email2@empresa.com.br"
                className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>

            {(ataRecipientsError || ataManualRecipients.error) && (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                {ataRecipientsError || ataManualRecipients.error}
              </p>
            )}

            {ataManualRecipients.emails.length > 0 && !ataManualRecipients.error && (
              <div className="mt-3 rounded-lg border border-border bg-secondary/35 p-3">
                <p className="text-xs uppercase tracking-widest text-primary">Destinatarios reconhecidos</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ataManualRecipients.emails.map((email) => (
                    <span key={email} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAtaManualRecipientsOpen(false);
                  setAtaSendOptionsOpen(true);
                }}
                className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  const parsed = parseEmailRecipients(ataRecipientsText);
                  if (parsed.error || parsed.emails.length === 0) {
                    setAtaRecipientsError(parsed.error || "Informe ao menos um destinatario.");
                    return;
                  }
                  setAtaRecipientsError(null);
                  setAtaManualRecipientsOpen(false);
                  setAtaSendConfirmOpen(true);
                }}
                className="agenda-pressable rounded-md border-0 bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {ataSendConfirmOpen && selectedAtaVisit && (
        <div
          data-no-print
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onTouchMove={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="agenda-fade-in fixed inset-0 z-[2147483647] flex h-[100dvh] w-full touch-none items-center justify-center overflow-hidden overscroll-none bg-background/90 px-4 backdrop-blur-md"
        >
          <div className="agenda-pop-in w-full max-w-[460px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-primary">Enviar ata</p>
            <h3 className="mt-2 text-xl font-bold">Confirmar envio?</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Confirma o envio da ATA da carteira{" "}
              <span className="font-semibold text-foreground">{selectedAtaVisit.carteira}</span>{" "}
              {ataSendMode === "manual"
                ? `para ${ataManualRecipients.emails.length} destinatario(s) selecionado(s)?`
                : "para a diretoria/gerencia?"}
            </p>
            {ataSendMode === "manual" && ataManualRecipients.emails.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-widest text-primary">Destinatarios</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ataManualRecipients.emails.map((email) => (
                    <span key={`confirm-${email}`} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {ataAttachments.length > 0
                ? `A ATA sera enviada com ${ataAttachments.length} anexo(s) complementar(es).`
                : "A ATA sera enviada sem anexos complementares."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAtaSendConfirmOpen(false);
                  if (ataSendMode === "manual") {
                    setAtaManualRecipientsOpen(true);
                  }
                }}
                disabled={ataSending}
                className="agenda-pressable rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAtaSendConfirmOpen(false);
                  sendAtaEmail();
                }}
                disabled={ataSending}
                className="agenda-pressable rounded-md border-0 bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ataSending ? "Enviando..." : "Confirmar envio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
