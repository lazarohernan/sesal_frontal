import type { ComputedRef, Ref } from 'vue'
import { computed, inject, provide, ref } from 'vue'

/**
 * Composable para manejar el filtro de región global
 * 
 * Cuando se accede con ?reg=X en la URL:
 * - regionForzada tendrá el valor del parámetro
 * - esFiltroForzado será true
 * - El selector de región debe estar bloqueado
 * 
 * Sin parámetro:
 * - regionForzada será null
 * - esFiltroForzado será false
 * - El selector de región funciona normal
 */

// Mapeo de códigos de región a nombres
export const REGIONES_MAP: Record<string, string> = {
  '1': 'Departamental de Atlántida',
  '2': 'Departamental de Colón',
  '3': 'Departamental de Comayagua',
  '4': 'Departamental de Copán',
  '5': 'Departamental de Cortés',
  '6': 'Departamental de Choluteca',
  '7': 'Departamental de El Paraíso',
  '8': 'Departamental de Francisco Morazán',
  '9': 'Departamental de Gracias a Dios',
  '10': 'Departamental de Intibucá',
  '11': 'Departamental de Islas de la Bahía',
  '12': 'Departamental de La Paz',
  '13': 'Departamental de Lempira',
  '14': 'Departamental de Ocotepeque',
  '15': 'Departamental de Olancho',
  '16': 'Departamental de Santa Bárbara',
  '17': 'Departamental de Valle',
  '18': 'Departamental de Yoro',
  '19': 'Metropolitana del Distrito Central',
  '20': 'Metropolitana de San Pedro Sula'
}

export interface RegionFilterState {
  /** Código de la región forzada por URL (ej: "1", "19") o null si no hay filtro */
  regionForzada: Ref<string | null>
  /** True si hay un filtro de región forzado por URL */
  esFiltroForzado: ComputedRef<boolean>
  /** Nombre de la región forzada o null */
  nombreRegionForzada: ComputedRef<string | null>
  /** Inicializa el filtro leyendo el parámetro ?reg de la URL */
  inicializarDesdeURL: () => void
}

const regionFilterSymbol = Symbol('regionFilter')

// Estado global del filtro de región
const regionForzada = ref<string | null>(null)

const esFiltroForzado = computed(() => regionForzada.value !== null)

const nombreRegionForzada = computed(() => {
  if (!regionForzada.value) return null
  return REGIONES_MAP[regionForzada.value] || `Región ${regionForzada.value}`
})

/**
 * Lee el parámetro ?reg de la URL y establece el filtro
 */
const inicializarDesdeURL = () => {
  if (typeof window === 'undefined') return
  
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const regParam = urlParams.get('reg')
    
    if (regParam) {
      // Validar que sea un número válido entre 1 y 20
      const regNum = parseInt(regParam, 10)
      if (regNum >= 1 && regNum <= 20) {
        regionForzada.value = regParam
        console.log(`[RegionFilter] Filtro de región activado: ${regParam} - ${REGIONES_MAP[regParam]}`)
      } else {
        console.warn(`[RegionFilter] Parámetro reg inválido: ${regParam}. Debe ser entre 1 y 20.`)
        regionForzada.value = null
      }
    } else {
      regionForzada.value = null
    }
  } catch (error) {
    console.error('[RegionFilter] Error al leer parámetros de URL:', error)
    regionForzada.value = null
  }
}

const regionFilterState: RegionFilterState = {
  regionForzada,
  esFiltroForzado,
  nombreRegionForzada,
  inicializarDesdeURL
}

/**
 * Provee el estado del filtro de región a los componentes hijos
 */
export const provideRegionFilter = () => {
  provide(regionFilterSymbol, regionFilterState)
  return regionFilterState
}

/**
 * Hook para usar el filtro de región en cualquier componente
 */
export const useRegionFilter = (): RegionFilterState => {
  const injected = inject<RegionFilterState>(regionFilterSymbol)
  
  if (injected) {
    return injected
  }
  
  // Si no está provisto, devolver el estado global directamente
  return regionFilterState
}

/**
 * Obtiene el filtro de región para usar en peticiones API
 * Retorna el objeto de filtro si hay región forzada, o undefined si no
 */
export const getRegionFilterForAPI = (): { field: string; values: string[] } | undefined => {
  if (!regionForzada.value) return undefined
  
  return {
    field: 'REGION',
    values: [regionForzada.value]
  }
}
