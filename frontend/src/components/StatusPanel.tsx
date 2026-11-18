import type { CSSProperties } from "react";

type StatusPanelProps = {
  title: string;
  content: string;
};

export default function StatusPanel({ title, content }: StatusPanelProps) {
  return (
    <section style={styles.card}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <pre style={styles.output}>{content}</pre>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#fffaf2",
    border: "1px solid #ddc9ab",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 40px rgba(60, 38, 17, 0.08)",
  },
  sectionTitle: {
    margin: "0 0 16px",
    fontSize: 20,
  },
  output: {
    margin: 0,
    minHeight: 120,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: 16,
    borderRadius: 18,
    background: "#20170f",
    color: "#f5ebde",
    border: "1px solid #47301d",
  },
};
