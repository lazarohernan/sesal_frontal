import type { PivotCatalogo, PivotQueryPayload, PivotQueryResult } from "../types/pivot";
import { CancellableRequestController, isAbortError } from "../utils/request.utils";

// Timeouts configurables según la complejidad de la consulta
const TIMEOUT_BASE_MS = 60_000; // 1 minuto base
const TIMEOUT_POR_ANIO_MS = 30_000; // 30 segundos adicionales por año
const TIMEOUT_MAXIMO_MS = 300_000; // 5 minutos máximo para consultas muy grandes

const normalizarBase = (base?: string) => {
  if (!base) return "";
  const trimmed = base.trim().replace(/\/+$/, "");
  return trimmed;
};

const construirUrl = (ruta: string, base?: string) => {
  const limpio = normalizarBase(base);
  if (!limpio) {
    return ruta;
  }
  return `${limpio}${ruta}`;
};

/**
 * Calcula el timeout basado en la cantidad de años a consultar
 */
const calcularTimeout = (numAnios: number): number => {
  const timeout = TIMEOUT_BASE_MS + (numAnios * TIMEOUT_POR_ANIO_MS);
  return Math.min(timeout, TIMEOUT_MAXIMO_MS);
};

// Tipos de error personalizados para el frontend
export interface PivotError {
  tipo: 'rate_limit' | 'timeout' | 'servidor_ocupado' | 'error_general';
  mensaje: string;
  titulo: string;
  reintentarEn?: number; // segundos
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData: PivotError;
    
    // Error 429: Rate Limit
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      errorData = {
        tipo: 'rate_limit',
        titulo: 'Demasiadas consultas',
        mensaje: `Has realizado muchas consultas en poco tiempo. Por favor espera ${retryAfter} segundos antes de intentar de nuevo.`,
        reintentarEn: retryAfter
      };
      throw errorData;
    }
    
    // Error 504: Timeout del servidor
    if (response.status === 504) {
      errorData = {
        tipo: 'timeout',
        titulo: 'La consulta tardó demasiado',
        mensaje: 'El servidor no pudo completar la consulta a tiempo. Intenta seleccionar menos años o agregar filtros para reducir la cantidad de datos.'
      };
      throw errorData;
    }
    
    // Error 503: Servidor ocupado
    if (response.status === 503) {
      errorData = {
        tipo: 'servidor_ocupado',
        titulo: 'Servidor ocupado',
        mensaje: 'El servidor está procesando muchas solicitudes. Por favor espera unos segundos e intenta de nuevo.',
        reintentarEn: 10
      };
      throw errorData;
    }
    
    // Otros errores
    const mensaje = await response.text();
    errorData = {
      tipo: 'error_general',
      titulo: 'Error en la consulta',
      mensaje: mensaje || 'Ocurrió un error inesperado. Por favor intenta de nuevo.'
    };
    throw errorData;
  }
  return response.json() as Promise<T>;
};

// Controladores para cancelar requests anteriores
const pivotQueryController = new CancellableRequestController();
const dimensionValuesController = new CancellableRequestController();

/**
 * Cancela cualquier consulta pivot en progreso.
 * Útil cuando el usuario cambia de vista o cierra el componente.
 */
export const cancelarConsultaPivot = () => {
  pivotQueryController.cancel();
};

/**
 * Cancela cualquier carga de valores de dimensión en progreso.
 */
export const cancelarCargaDimension = () => {
  dimensionValuesController.cancel();
};

/**
 * Verifica si un error es por cancelación de request.
 */
export { isAbortError };

export const obtenerCatalogoPivotApi = async (baseUrl?: string): Promise<PivotCatalogo> => {
  const respuesta = await fetch(construirUrl("/api/pivot/catalogo", baseUrl));
  return handleResponse<PivotCatalogo>(respuesta);
};

export const consultarPivotApi = async (
  payload: PivotQueryPayload,
  baseUrl?: string
): Promise<{ resultado: PivotQueryResult; generadoEn: string }> => {
  // Cancelar request anterior y obtener nueva señal
  const signal = pivotQueryController.getSignal();
  
  // Calcular timeout basado en cantidad de años
  const numAnios = payload.years?.length ?? 1;
  const timeoutMs = calcularTimeout(numAnios);
  
  // Crear un AbortController para el timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);
  
  // Combinar señales: cancelación manual + timeout
  const combinedSignal = signal;
  
  try {
    const respuesta = await fetch(construirUrl("/api/pivot/consulta", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: combinedSignal
    });
    
    clearTimeout(timeoutId);
    return handleResponse<{ resultado: PivotQueryResult; generadoEn: string }>(respuesta);
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Detectar timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      // Verificar si fue timeout o cancelación manual
      if (timeoutController.signal.aborted) {
        throw new Error(`La consulta de ${numAnios} año(s) tardó más de ${Math.round(timeoutMs / 1000)} segundos. Intenta con menos años o más filtros.`);
      }
    }
    throw error;
  }
};

export const obtenerValoresDimensionApi = async (
  dimensionId: string,
  busqueda?: string,
  limite = 200,
  baseUrl?: string,
  filtroRegion?: string,
  filtroMunicipio?: string
) => {
  // Cancelar request anterior de valores de dimensión
  const signal = dimensionValuesController.getSignal();
  
  const parametros = new URLSearchParams();
  if (busqueda) parametros.set("busqueda", busqueda);
  if (limite) parametros.set("limite", String(limite));
  if (filtroRegion) parametros.set("filtroRegion", filtroRegion);
  if (filtroMunicipio) parametros.set("filtroMunicipio", filtroMunicipio);

  const respuesta = await fetch(
    construirUrl(`/api/pivot/dimensiones/${dimensionId}/valores?${parametros.toString()}`, baseUrl),
    { signal }
  );
  return handleResponse<{ valores: Array<{ valor: string | number; etiqueta: string }>; generadoEn: string }>(
    respuesta
  );
};

