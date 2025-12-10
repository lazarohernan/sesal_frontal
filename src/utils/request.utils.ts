/**
 * Utilidades para manejo de requests HTTP con debounce y cancelación.
 * Optimizado para sistemas BI con consultas frecuentes.
 */

/**
 * Crea una función debounced que retrasa la ejecución hasta que
 * haya pasado el tiempo especificado sin nuevas llamadas.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Crea una función debounced que retorna una Promise.
 * Útil para funciones async que necesitan debounce.
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: Awaited<ReturnType<T>>) => void) | null = null;
  let pendingReject: ((reason: unknown) => void) | null = null;

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      // Cancelar timeout anterior
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Guardar los resolvers actuales
      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          if (pendingResolve) {
            pendingResolve(result as Awaited<ReturnType<T>>);
          }
        } catch (error) {
          if (pendingReject) {
            pendingReject(error);
          }
        } finally {
          timeoutId = null;
          pendingResolve = null;
          pendingReject = null;
        }
      }, delayMs);
    });
  };
}

/**
 * Controlador de requests cancelables.
 * Permite cancelar requests anteriores cuando se inicia uno nuevo.
 */
export class CancellableRequestController {
  private controller: AbortController | null = null;
  private requestId = 0;

  /**
   * Obtiene una señal de abort para el request actual.
   * Cancela automáticamente cualquier request anterior.
   */
  getSignal(): AbortSignal {
    // Cancelar request anterior si existe
    if (this.controller) {
      this.controller.abort();
    }

    // Crear nuevo controller
    this.controller = new AbortController();
    this.requestId++;

    return this.controller.signal;
  }

  /**
   * Cancela el request actual si existe.
   */
  cancel(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * Verifica si el request fue cancelado.
   */
  isCancelled(): boolean {
    return this.controller?.signal.aborted ?? false;
  }

  /**
   * Obtiene el ID del request actual (útil para debugging).
   */
  getCurrentRequestId(): number {
    return this.requestId;
  }
}

/**
 * Verifica si un error es debido a cancelación de request.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Wrapper para fetch con soporte de cancelación y timeout.
 */
export async function fetchWithCancel<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  controller?: CancellableRequestController
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  // Usar controller proporcionado o crear uno temporal
  const abortController = controller
    ? null
    : new AbortController();
  
  const signal = controller
    ? controller.getSignal()
    : abortController!.signal;

  // Configurar timeout
  const timeoutId = setTimeout(() => {
    if (abortController) {
      abortController.abort();
    } else if (controller) {
      controller.cancel();
    }
  }, timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Crea un fetcher con debounce y cancelación automática.
 * Ideal para búsquedas y filtros en tiempo real.
 */
export function createDebouncedFetcher<TArgs extends unknown[], TResult>(
  fetcher: (...args: TArgs) => Promise<TResult>,
  delayMs: number = 300
) {
  const controller = new CancellableRequestController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFetch = (...args: TArgs): Promise<TResult> => {
    return new Promise((resolve, reject) => {
      // Cancelar timeout anterior
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Cancelar request anterior
      controller.cancel();

      timeoutId = setTimeout(async () => {
        try {
          const result = await fetcher(...args);
          resolve(result);
        } catch (error) {
          if (!isAbortError(error)) {
            reject(error);
          }
        }
      }, delayMs);
    });
  };

  return {
    fetch: debouncedFetch,
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      controller.cancel();
    }
  };
}

// Tiempos de debounce recomendados
export const DEBOUNCE_TIMES = {
  /** Para búsquedas de texto mientras el usuario escribe */
  SEARCH: 300,
  /** Para cambios de filtros en selectores */
  FILTER: 200,
  /** Para consultas pivot que pueden ser costosas */
  PIVOT_QUERY: 400,
  /** Para resize de ventana */
  RESIZE: 150
} as const;
