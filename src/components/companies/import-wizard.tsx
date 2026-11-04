"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { parseCsv } from "@/lib/utils/csv";
import { CSV_TARGET_FIELDS, companyCsvRowSchema, type CsvTargetFieldKey } from "@/lib/validation/companies";
import { importCompaniesAction, type ImportActionResult } from "@/modules/companies/import-actions";

const initialState: ImportActionResult = { success: false };

type Step = "upload" | "map" | "review";
type Mapping = Partial<Record<CsvTargetFieldKey, number>>;

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(importCompaniesAction, initialState);

  const preview = useMemo(() => {
    if (step !== "review") return null;
    let valid = 0;
    let invalid = 0;
    const sample: { line: number; name: string; ok: boolean; issue?: string }[] = [];

    rows.forEach((row, index) => {
      const mapped: Record<string, string> = {};
      for (const [field, columnIndex] of Object.entries(mapping)) {
        if (columnIndex === undefined) continue;
        mapped[field] = (row[columnIndex] ?? "").trim();
      }
      const parsed = companyCsvRowSchema.safeParse(mapped);
      if (parsed.success) valid += 1;
      else invalid += 1;

      if (index < 10) {
        sample.push({
          line: index + 2,
          name: mapped.name || "(sem nome)",
          ok: parsed.success,
          issue: parsed.success ? undefined : parsed.error.issues[0]?.message,
        });
      }
    });

    return { valid, invalid, total: rows.length, sample };
  }, [step, rows, mapping]);

  function handleFile(file: File) {
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setUploadError("Não foi possível ler o arquivo, ou ele está vazio.");
        return;
      }
      setFileName(file.name);
      setCsvText(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping({});
      setStep("map");
    };
    reader.onerror = () => setUploadError("Falha ao ler o arquivo.");
    reader.readAsText(file, "utf-8");
  }

  if (state.success && state.result) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#13372f] text-[#78e7ba]">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-[var(--ff-text-primary)]">Importação concluída</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Linhas no arquivo" value={state.result.total} />
          <Stat label="Criadas" value={state.result.created} tone="success" />
          <Stat label="Duplicadas (não importadas)" value={state.result.duplicates} tone="warning" />
          <Stat label="Com erro" value={state.result.failed} tone="danger" />
        </dl>
        <div className="flex gap-3">
          <Link href="/companies">
            <Button size="sm">Ver empresas</Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setStep("upload");
              setFileName("");
              setCsvText("");
              setHeaders([]);
              setRows([]);
              setMapping({});
            }}
          >
            Importar outro arquivo
          </Button>
        </div>
      </div>
    );
  }

  if (step === "upload") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[var(--ff-radius-lg)] border border-dashed border-[var(--ff-border-subtle)] px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-[var(--ff-radius-md)] bg-[rgba(117,65,200,0.17)] text-[var(--ff-violet-glow)]">
          <Upload className="size-5" aria-hidden />
        </span>
        <p className="font-medium text-[var(--ff-text-primary)]">Selecione um arquivo CSV</p>
        <p className="max-w-sm text-sm text-[var(--ff-text-muted)]">
          Aceita arquivos exportados de planilhas (Excel, Google Sheets) com cabeçalho na primeira linha.
        </p>
        <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-[var(--ff-purple-600)] to-[var(--ff-magenta)] px-5 text-sm font-medium text-white transition-colors duration-150 hover:brightness-110">
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          Escolher arquivo
        </label>
        {uploadError ? <p className="text-sm text-[var(--ff-danger)]">{uploadError}</p> : null}
      </div>
    );
  }

  if (step === "map") {
    const nameMapped = mapping.name !== undefined;
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--ff-text-secondary)]">
          <FileSpreadsheet className="mr-1.5 inline size-4" aria-hidden />
          <b className="text-[var(--ff-text-primary)]">{fileName}</b> — {rows.length} linha(s) encontrada(s).
          Associe cada coluna do arquivo ao campo correspondente.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CSV_TARGET_FIELDS.map((field) => (
            <SelectField
              key={field.key}
              label={`${field.label}${field.required ? " *" : ""}`}
              value={mapping[field.key] ?? ""}
              onChange={(e) =>
                setMapping((prev) => ({
                  ...prev,
                  [field.key]: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
            >
              <option value="">— não importar —</option>
              {headers.map((header, index) => (
                <option key={header + index} value={index}>
                  {header}
                </option>
              ))}
            </SelectField>
          ))}
        </div>
        <div className="flex gap-3">
          <Button size="sm" disabled={!nameMapped} onClick={() => setStep("review")}>
            Ver preview
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setStep("upload")}>
            Trocar arquivo
          </Button>
        </div>
        {!nameMapped ? (
          <p className="text-sm text-[var(--ff-text-muted)]">Mapeie a coluna de Nome para continuar.</p>
        ) : null}
      </div>
    );
  }

  // step === "review"
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="csvText" value={csvText} />
      <input type="hidden" name="fileName" value={fileName} />
      <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />

      <dl className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="Total de linhas" value={preview?.total ?? 0} />
        <Stat label="Válidas" value={preview?.valid ?? 0} tone="success" />
        <Stat label="Com problema" value={preview?.invalid ?? 0} tone={preview?.invalid ? "danger" : undefined} />
      </dl>

      <div className="overflow-x-auto rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)]">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--ff-border-subtle)] text-xs text-[var(--ff-text-muted)] uppercase">
              <th className="px-4 py-2 font-medium">Linha</th>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d243c]">
            {preview?.sample.map((row) => (
              <tr key={row.line}>
                <td className="px-4 py-2 text-[var(--ff-text-muted)]">{row.line}</td>
                <td className="px-4 py-2 text-[var(--ff-text-primary)]">{row.name}</td>
                <td className="px-4 py-2">
                  {row.ok ? (
                    <span className="text-[#78e7ba]">OK</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[var(--ff-danger)]">
                      <AlertTriangle className="size-3.5" aria-hidden /> {row.issue}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 10 ? (
          <p className="px-4 py-2 text-xs text-[var(--ff-text-muted)]">
            Mostrando as 10 primeiras de {rows.length} linhas. A validação completa roda ao confirmar.
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Importando..." : `Confirmar importação (${preview?.valid ?? 0} empresas)`}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setStep("map")}>
          Voltar ao mapeamento
        </Button>
      </div>
    </form>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-[#78e7ba]"
      : tone === "warning"
        ? "text-[#f9d57b]"
        : tone === "danger"
          ? "text-[var(--ff-danger)]"
          : "text-[var(--ff-text-primary)]";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-[var(--ff-text-muted)] uppercase">{label}</dt>
      <dd className={`text-xl font-semibold ${color}`}>{value.toLocaleString("pt-BR")}</dd>
    </div>
  );
}
