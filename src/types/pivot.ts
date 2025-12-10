export type DimensionType = "string" | "number";

export interface PivotCatalogoDimension {
  id: string;
  etiqueta: string;
  tipo: DimensionType;
  admiteFiltrado: boolean;
  valores?: Array<{ valor: string | number; etiqueta: string }>;
  totalValores?: number;
  endpointValores?: string;
}

export interface PivotCatalogoMedida {
  id: string;
  etiqueta: string;
  descripcion: string;
  agregacionPorDefecto: "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
}

export interface PivotCatalogo {
  dimensiones: PivotCatalogoDimension[];
  medidas: PivotCatalogoMedida[];
  actualizadoEn: string;
}

export interface PivotValueRequest {
  field: string;
  aggregation?: "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
}

export interface PivotFilter {
  field: string;
  values?: Array<string | number>;
}

export interface PivotFilterOption {
  valor: string | number;
  etiqueta: string;
}

export interface PivotFilterState {
  field: string;
  label: string;
  options: PivotFilterOption[];
  seleccionados: Array<string | number>;
  /** Si es true, el filtro está bloqueado y no se puede modificar (ej: filtro de región forzado por URL) */
  bloqueado?: boolean;
}

export interface PivotQueryPayload {
  year?: number;
  years?: number[];
  filters?: PivotFilter[];
  rows?: string[];
  columns?: string[];
  values: PivotValueRequest[];
  limit?: number;
  includeTotals?: boolean;
}

export interface PivotQueryResult {
  datos: Array<Record<string, unknown>>;
  totalGeneral: Record<string, unknown> | null;
  aniosConsultados: number[];
  metadata: {
    dimensionesSeleccionadas: string[];
    dimensionesFilas: string[];
    dimensionesColumnas: string[];
    medidasSeleccionadas: string[];
  };
}


