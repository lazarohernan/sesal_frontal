<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import maplibregl from 'maplibre-gl'
import type {
  ExpressionSpecification,
  MapLayerMouseEvent,
  MapOptions,
  StyleSpecification
} from 'maplibre-gl'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
// eslint-disable-next-line import/no-unresolved
import MapLibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { DepartamentoMapa } from '../../types/tablero'
import { useRegionFilter } from '../../composables/useRegionFilter'

;(maplibregl as typeof maplibregl & { workerClass?: typeof Worker }).workerClass =
  MapLibreWorker as unknown as typeof Worker

interface TotalesDepartamento {
  totalConsultas: number;
  enfermeraAuxiliar: number;
  enfermeraProfesional: number;
  medicinaGeneral: number;
  medicosEspecialistas: number;
  totalUnidades: number;
}

const mapaContainer = ref<HTMLDivElement | null>(null)
const cargando = ref<boolean>(true)
const error = ref<string | null>(null)
const cargandoTotales = ref<boolean>(false)
const datosMunicipales = ref<TotalesDepartamento | null>(null)
const datosDepartamentos = ref<DepartamentoMapa[]>([])
const geojsonBase = ref<FeatureCollection<Geometry, Record<string, unknown>> | null>(null)
type GeoJSONFeature = Feature<Geometry, Record<string, unknown>>
type GeoJSONCollection = FeatureCollection<Geometry, Record<string, unknown>>
const totalesDepartamento = computed<TotalesDepartamento>(() => {
  return datosMunicipales.value ?? {
    totalConsultas: 0,
    enfermeraAuxiliar: 0,
    enfermeraProfesional: 0,
    medicinaGeneral: 0,
    medicosEspecialistas: 0,
    totalUnidades: 0
  }
})

interface DepartamentoSeleccionado {
  id: number;
  nombre: string;
}

interface FeatureDepartamento {
  properties?: {
    shapeISO?: string;
    shapeName?: string;
    departamentoId?: number;
  };
}

const departamentoSeleccionado = ref<DepartamentoSeleccionado | null>(null)
const departamentoIdSeleccionado = ref<number | null>(null)
const regionSeleccionada = ref<number | null>(null) // Para Cortés: región 5 o 20
let mapa: maplibregl.Map | null = null

// Filtro de región global (desde URL ?reg=X)
const { regionForzada, esFiltroForzado, nombreRegionForzada } = useRegionFilter()

// Mapeo de región a departamento (para resaltar en el mapa)
// Regiones 1-18 corresponden directamente a departamentos 1-18
// Región 19 (Metropolitana DC) está en departamento 8 (Francisco Morazán)
// Región 20 (Metropolitana SPS) está en departamento 5 (Cortés)
const regionADepartamento = (region: string | null): number | null => {
  if (!region) return null
  const regNum = parseInt(region, 10)
  if (regNum >= 1 && regNum <= 18) return regNum
  if (regNum === 19) return 8 // Francisco Morazán
  if (regNum === 20) return 5 // Cortés
  return null
}

// Nombres de departamentos por ID
const nombresDepartamentos: Record<number, string> = {
  1: 'Atlántida', 2: 'Colón', 3: 'Comayagua', 4: 'Copán', 5: 'Cortés',
  6: 'Choluteca', 7: 'El Paraíso', 8: 'Francisco Morazán', 9: 'Gracias a Dios',
  10: 'Intibucá', 11: 'Islas de la Bahía', 12: 'La Paz', 13: 'Lempira',
  14: 'Ocotepeque', 15: 'Olancho', 16: 'Santa Bárbara', 17: 'Valle', 18: 'Yoro'
}

// Coordenadas centrales de cada departamento para zoom
const coordenadasDepartamentos: Record<number, [number, number]> = {
  1: [-86.8, 15.75],   // Atlántida
  2: [-85.9, 15.65],   // Colón
  3: [-87.65, 14.45],  // Comayagua
  4: [-88.8, 14.85],   // Copán
  5: [-87.95, 15.5],   // Cortés
  6: [-87.15, 13.35],  // Choluteca
  7: [-86.5, 14.0],    // El Paraíso
  8: [-87.2, 14.3],    // Francisco Morazán
  9: [-84.5, 15.2],    // Gracias a Dios
  10: [-88.15, 14.35], // Intibucá
  11: [-86.5, 16.4],   // Islas de la Bahía
  12: [-87.85, 14.15], // La Paz
  13: [-88.55, 14.55], // Lempira
  14: [-89.15, 14.45], // Ocotepeque
  15: [-86.0, 14.7],   // Olancho
  16: [-88.25, 14.95], // Santa Bárbara
  17: [-87.6, 13.35],  // Valle
  18: [-87.45, 15.15]  // Yoro
}
const esModoOscuro = ref<boolean>(false)
let observer: MutationObserver | null = null

// Estado original del mapa capturado cuando se carga por primera vez
let estadoOriginalMapa: { center: [number, number]; zoom: number; pitch: number; bearing: number } | null = null

// Función para volver a la vista general de Honduras
const volverVistaGeneral = () => {
  regionSeleccionada.value = null // Resetear región seleccionada
  if (mapa && estadoOriginalMapa) {
    // Usar easeTo para una transición suave y controlada
    // Resetear padding a 0 para volver a la vista original sin desplazamientos
    mapa.easeTo({
      center: estadoOriginalMapa.center,
      zoom: estadoOriginalMapa.zoom,
      pitch: 0, // Siempre resetear a vista plana
      bearing: 0, // Siempre resetear a norte arriba
      padding: { top: 0, bottom: 0, left: 0, right: 0 }, // Sin padding
      duration: 1500, // Animación suave de 1.5 segundos
      essential: true
    })

    // Limpiar selección de departamento
    departamentoSeleccionado.value = null
    departamentoIdSeleccionado.value = null
    regionSeleccionada.value = null
    datosMunicipales.value = null
    actualizarColores()
    actualizarEtiquetas()
    actualizarPuntosRegiones() // Esto restaurará los filtros correctamente
  }
}

const totalesDepartamentosMapa = computed(() => {
  const resultado = new Map<number, DepartamentoMapa>()
  datosDepartamentos.value.forEach((departamento) => {
    resultado.set(departamento.departamentoId, departamento)
  })
  return resultado
})

const obtenerTotalDepartamento = (departamentoId: number) => {
  const datos = totalesDepartamentosMapa.value.get(departamentoId)
  if (!datos) return 0
  // Si anio es null, mostrar total histórico
  if (props.anio === null) {
    return datos.totalHistorico
  }
  switch (props.anio) {
    case 2025:
      return datos.total2025 ?? datos.totalHistorico
    case 2024:
      return datos.total2024 ?? datos.totalHistorico
    case 2023:
      return datos.total2023 ?? datos.totalHistorico
    default:
      return datos.totalHistorico
  }
}

const props = defineProps<{ anio: number | null; apiBase?: string }>()
const apiBaseNormalizado = computed(() => {
  const raw = typeof props.apiBase === 'string' ? props.apiBase.trim() : ''
  if (raw) return raw
  try {
    return window.location.origin
  } catch (_error) {
    return 'http://localhost:4000'
  }
})

const emit = defineEmits<{
  'update:anio': [anio: number | null]
}>()

const createApiUrl = (path: string) => {
  const base = apiBaseNormalizado.value
  try {
    if (/^https?:\/\//i.test(path)) {
      return new URL(path)
    }
    if (base && /^https?:\/\//i.test(base)) {
      return new URL(path, base)
    }
    const origen = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
    return new URL(path, origen)
  } catch (_error) {
    const origen = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
    return new URL(path, origen)
  }
}

const buildApiUrl = (path: string) => createApiUrl(path).toString()

const buildStaticUrl = (path: string) => {
  const normalizado = path.replace(/^\//, '')
  const base = import.meta.env.BASE_URL ?? '/'
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/\/$/, '')}/${normalizado}`
  }
  if (typeof window !== 'undefined') {
    const prefijo = base === '/' ? '' : base.replace(/\/$/, '')
    return `${window.location.origin}${prefijo}/${normalizado}`
  }
  return `/${normalizado}`
}

const construirCandidatosApi = (path: string, params?: URLSearchParams) => {
  const candidatos = new Set<string>()
  const appendParams = (url: string) => {
    if (!params || !params.toString()) return url
    const separador = url.includes('?') ? '&' : '?'
    return `${url}${separador}${params.toString()}`
  }

  const principal = buildApiUrl(path)
  candidatos.add(appendParams(principal))

  if (typeof window !== 'undefined') {
    const relativo = new URL(path, window.location.origin).toString()
    candidatos.add(appendParams(relativo))
    const soloPath = appendParams(path.startsWith('/') ? path : `/${path}`)
    candidatos.add(soloPath)
  }

  return Array.from(candidatos.values())
}

const fetchApiConFallback = async (path: string, params?: URLSearchParams) => {
  const candidatos = construirCandidatosApi(path, params)
  let ultimoError: unknown = null
  for (const url of candidatos) {
    try {
      const respuesta = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      })
      if (respuesta.ok) {
        return respuesta
      }
      ultimoError = new Error(`Solicitud falló (${respuesta.status})`)
    } catch (error) {
      ultimoError = error
    }
  }
  throw ultimoError ?? new Error('No se pudo completar la solicitud')
}

// Estado para rastrear si "Total" está seleccionado
const totalSeleccionado = ref(false)

const aniosDisponibles = computed(() => {
  const anios: Array<{ valor: number | null; etiqueta: string }> = []
  // Agregar todos los años desde 2008 hasta 2025 (de izquierda a derecha)
  for (let anio = 2008; anio <= 2025; anio++) {
    anios.push({ valor: anio, etiqueta: String(anio) })
  }
  // Agregar "Total" al final
  anios.push({ valor: null, etiqueta: 'Total' })
  return anios
})

const seleccionarAnio = (item: { valor: number | null; etiqueta: string }) => {
  if (item.valor === null) {
    // Si es "Total", marcarlo como seleccionado y emitir null
    totalSeleccionado.value = true
    emit('update:anio', null)
  } else {
    // Si es un año específico, desmarcar "Total"
    totalSeleccionado.value = false
    emit('update:anio', item.valor)
  }
}

const isoToDepartamentoId: Record<string, number> = {
  'HN-AT': 1,
  'HN-CL': 2,
  'HN-CM': 3,
  'HN-CP': 4,
  'HN-CR': 5,
  'HN-CH': 6,
  'HN-EP': 7,
  'HN-FM': 8,
  'HN-GD': 9,
  'HN-IN': 10,
  'HN-IB': 11,
  'HN-LP': 12,
  'HN-LE': 13,
  'HN-OC': 14,
  'HN-OL': 15,
  'HN-SB': 16,
  'HN-VA': 17,
  'HN-YO': 18
}

const colorFondoMapa = computed(() => (esModoOscuro.value ? '#0d1b32' : '#f4f8ff'))

const crearExpresionColor = (): ExpressionSpecification => [
  'case',
  // Si está seleccionado, azul cielo fuerte
  ['==', ['get', 'departamentoId'], departamentoIdSeleccionado.value || -1],
  '#0ea5e9',
  // Si no, blanco
  '#ffffff'
]

const actualizarColores = () => {
  if (!mapa) return
  const expresion = crearExpresionColor()
  mapa.setPaintProperty('departamentos-fill', 'fill-color', expresion)
}

const actualizarEtiquetas = () => {
  if (!mapa) return
  // Mostrar solo la etiqueta del departamento seleccionado
  const filtro: any = departamentoIdSeleccionado.value !== null
    ? ['==', ['get', 'departamentoId'], departamentoIdSeleccionado.value]
    : ['==', ['get', 'departamentoId'], -1] // -1 para no mostrar ninguna etiqueta
  
  mapa.setFilter('departamentos-etiquetas', filtro)
}

const actualizarFondoMapa = () => {
  if (!mapa) return
  mapa.setPaintProperty('background', 'background-color', colorFondoMapa.value)
}

const construirGeojsonConTotales = (): GeoJSONCollection | null => {
  if (!geojsonBase.value) return null
  return {
    ...geojsonBase.value,
    features: geojsonBase.value.features.map((feature) => {
      const propiedades = feature.properties ?? {}
      const departamentoId = Number(propiedades.departamentoId ?? 0)
      return {
        ...feature,
        properties: {
          ...propiedades,
          totalConsultas: obtenerTotalDepartamento(departamentoId)
        }
      } as GeoJSONFeature
    })
  }
}

// Función para calcular el centroide geométrico real de un polígono
// Usa el algoritmo basado en el área para obtener el centro verdadero
const calcularCentroide = (coordinates: number[][]): [number, number] => {
  if (!coordinates || coordinates.length < 3) return [-86.25, 14.6]
  
  let area = 0
  let centroidX = 0
  let centroidY = 0
  
  // Algoritmo para calcular el centroide de un polígono
  for (let i = 0; i < coordinates.length - 1; i++) {
    const x0 = coordinates[i]?.[0] ?? 0
    const y0 = coordinates[i]?.[1] ?? 0
    const x1 = coordinates[i + 1]?.[0] ?? 0
    const y1 = coordinates[i + 1]?.[1] ?? 0
    
    const crossProduct = x0 * y1 - x1 * y0
    area += crossProduct
    centroidX += (x0 + x1) * crossProduct
    centroidY += (y0 + y1) * crossProduct
  }
  
  area = area / 2
  
  if (Math.abs(area) < 0.0001) {
    // Si el área es cero, usar promedio simple
    let sumX = 0
    let sumY = 0
    coordinates.forEach(coord => {
      sumX += coord?.[0] ?? 0
      sumY += coord?.[1] ?? 0
    })
    return [sumX / coordinates.length, sumY / coordinates.length]
  }
  
  centroidX = centroidX / (6 * area)
  centroidY = centroidY / (6 * area)
  
  return [centroidX, centroidY]
}

// Coordenadas aproximadas para las regiones de Cortés
// Calculadas basándose en el GeoJSON del departamento de Cortés
// Región 5 (Cortés): zona este/sur de Cortés
// Posicionado más abajo y a la izquierda (oeste) dentro del departamento
const COORDENADAS_REGION_5 = [-88.0, 15.20] as [number, number]
// Región 20 (Metropolitana de San Pedro Sula): zona oeste de Cortés
// Coordenadas de San Pedro Sula: 15.50585° N, 88.02588° O
// Posicionado en la parte oeste del departamento (cerca de San Pedro Sula)
const COORDENADAS_REGION_20 = [-88.03, 15.50] as [number, number]

// Coordenadas aproximadas para las regiones de Francisco Morazán
// Calculadas basándose en el GeoJSON del departamento de Francisco Morazán
// Región 8 (Departamental de Francisco Morazán): zona este/norte del departamento
// Posicionado más a la izquierda (oeste) dentro del departamento
const COORDENADAS_REGION_8_FMO = [-87.0, 14.5] as [number, number]
// Región 19 (Metropolitana del Distrito Central): centro de Tegucigalpa
// Coordenadas de Tegucigalpa: 14.1° N, 87.22° O
// Posicionado en el centro del departamento (cerca de Tegucigalpa)
const COORDENADAS_REGION_19 = [-87.22, 14.1] as [number, number]

// Crear GeoJSON de puntos centrales para cada departamento
const construirCentroidesDepartamentos = (): GeoJSONCollection | null => {
  if (!geojsonBase.value) return null
  
  const features = geojsonBase.value.features.map((feature) => {
    const propiedades = feature.properties ?? {}
    let centroide: [number, number] = [-86.25, 14.6]
    
    // Para Cortés (5), usar el centroide normal del departamento
    // Los puntos de región se manejarán por separado
    if (feature.geometry) {
      if (feature.geometry.type === 'Polygon') {
        // Para Polygon simple, usar el primer anillo (exterior)
        const coordinates = feature.geometry.coordinates[0] as number[][]
        centroide = calcularCentroide(coordinates)
      } else if (feature.geometry.type === 'MultiPolygon') {
        // Para MultiPolygon (como Islas de la Bahía), calcular centroide del polígono más grande
        const polygons = feature.geometry.coordinates as number[][][][]
        let largestPolygon: number[][] = []
        let maxPoints = 0
        
        polygons.forEach(polygon => {
          const ring = polygon[0] // Primer anillo de cada polígono
          if (ring && ring.length > maxPoints) {
            largestPolygon = ring as number[][]
            maxPoints = ring.length
          }
        })
        
        if (largestPolygon.length > 0) {
          centroide = calcularCentroide(largestPolygon)
        }
      }
    }
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: centroide
      },
      properties: propiedades
    }
  })
  
  console.log(`Centroides calculados para ${features.length} departamentos:`, 
    features.map(f => f.properties?.shapeName || 'Sin nombre'))
  
  return {
    type: 'FeatureCollection',
    features
  } as GeoJSONCollection
}

// Crear GeoJSON de puntos para las regiones de Cortés
const construirPuntosRegionesCortes = (): GeoJSONCollection => {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: COORDENADAS_REGION_5
        },
        properties: {
          departamentoId: 5,
          regionId: 5,
          nombre: 'Cortés',
          tipo: 'region'
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: COORDENADAS_REGION_20
        },
        properties: {
          departamentoId: 5,
          regionId: 20,
          nombre: 'Metropolitana de San Pedro Sula',
          tipo: 'region'
        }
      }
    ]
  } as GeoJSONCollection
}

// Crear GeoJSON de puntos para las regiones de Francisco Morazán
const construirPuntosRegionesFMO = (): GeoJSONCollection => {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: COORDENADAS_REGION_8_FMO
        },
        properties: {
          departamentoId: 8,
          regionId: 8,
          nombre: 'Francisco Morazán',
          tipo: 'region'
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: COORDENADAS_REGION_19
        },
        properties: {
          departamentoId: 8,
          regionId: 19,
          nombre: 'Metropolitana del Distrito Central',
          tipo: 'region'
        }
      }
    ]
  } as GeoJSONCollection
}

const actualizarFuenteGeografica = () => {
  if (!mapa || !geojsonBase.value) return
  const dataActualizada = construirGeojsonConTotales()
  if (!dataActualizada) return
  const fuente = mapa.getSource('honduras') as maplibregl.GeoJSONSource | undefined
  if (fuente?.setData) {
    fuente.setData(dataActualizada)
  }
}

const actualizarPuntosRegiones = () => {
  if (!mapa) return
  const fuenteCortes = mapa.getSource('regiones-cortes') as maplibregl.GeoJSONSource | undefined
  const fuenteFMO = mapa.getSource('regiones-fmo') as maplibregl.GeoJSONSource | undefined
  
  // Mostrar puntos solo si el departamento correspondiente está seleccionado
  const mostrarPuntosCortes = departamentoIdSeleccionado.value === 5
  const mostrarPuntosFMO = departamentoIdSeleccionado.value === 8
  
  const visibilidadCortes = mostrarPuntosCortes ? 'visible' : 'none'
  const visibilidadFMO = mostrarPuntosFMO ? 'visible' : 'none'
  
  // Actualizar visibilidad de puntos de Cortés
  if (fuenteCortes) {
    mapa.setLayoutProperty('regiones-cortes-puntos', 'visibility', visibilidadCortes)
    mapa.setLayoutProperty('regiones-cortes-etiquetas', 'visibility', visibilidadCortes)
  }
  
  // Actualizar visibilidad de puntos de Francisco Morazán
  if (fuenteFMO) {
    mapa.setLayoutProperty('regiones-fmo-puntos', 'visibility', visibilidadFMO)
    mapa.setLayoutProperty('regiones-fmo-etiquetas', 'visibility', visibilidadFMO)
  }
  
  // Ocultar el punto general del departamento cuando se muestran los puntos de región
  const departamentosConPuntosRegionales = []
  if (mostrarPuntosCortes) departamentosConPuntosRegionales.push(5)
  if (mostrarPuntosFMO) departamentosConPuntosRegionales.push(8)
  
  if (departamentosConPuntosRegionales.length > 0) {
    // Filtrar para ocultar los puntos de departamentos con puntos regionales
    mapa.setFilter('departamentos-puntos', [
      '!',
      ['in', ['get', 'departamentoId'], ['literal', departamentosConPuntosRegionales]]
    ])
    // Ocultar también la etiqueta grande del departamento cuando se muestran puntos de región
    mapa.setFilter('departamentos-etiquetas', [
      '!',
      ['in', ['get', 'departamentoId'], ['literal', departamentosConPuntosRegionales]]
    ])
  } else {
    // Mostrar todos los puntos cuando no hay selección
    mapa.setFilter('departamentos-puntos', ['has', 'departamentoId'])
    // Actualizar etiquetas según el departamento seleccionado
    actualizarEtiquetas()
  }
  
  // Actualizar color de los puntos según la región seleccionada para Cortés
  if (mostrarPuntosCortes && regionSeleccionada.value) {
    mapa.setPaintProperty('regiones-cortes-puntos', 'circle-color', [
      'case',
      ['==', ['get', 'regionId'], regionSeleccionada.value],
      '#3b82f6', // Azul para el seleccionado
      '#f59e0b' // Naranja para los demás
    ])
    mapa.setFilter('regiones-cortes-puntos', ['has', 'regionId'])
  } else if (mostrarPuntosCortes) {
    mapa.setPaintProperty('regiones-cortes-puntos', 'circle-color', '#f59e0b')
    mapa.setFilter('regiones-cortes-puntos', ['has', 'regionId'])
  }
  
  // Actualizar color de los puntos según la región seleccionada para Francisco Morazán
  if (mostrarPuntosFMO && regionSeleccionada.value) {
    mapa.setPaintProperty('regiones-fmo-puntos', 'circle-color', [
      'case',
      ['==', ['get', 'regionId'], regionSeleccionada.value],
      '#3b82f6', // Azul para el seleccionado
      '#f59e0b' // Naranja para los demás
    ])
    mapa.setFilter('regiones-fmo-puntos', ['has', 'regionId'])
  } else if (mostrarPuntosFMO) {
    mapa.setPaintProperty('regiones-fmo-puntos', 'circle-color', '#f59e0b')
    mapa.setFilter('regiones-fmo-puntos', ['has', 'regionId'])
  }
}

// Función para aplicar el filtro de región forzado al mapa
const aplicarFiltroRegionForzado = async (mapInstance: maplibregl.Map) => {
  if (!regionForzada.value) return
  
  const regNum = parseInt(regionForzada.value, 10)
  const departamentoId = regionADepartamento(regionForzada.value)
  
  if (!departamentoId) return
  
  console.log(`[MapaHonduras] Aplicando filtro de región forzado: ${regNum} -> Departamento ${departamentoId}`)
  
  // Establecer el departamento seleccionado
  departamentoIdSeleccionado.value = departamentoId
  departamentoSeleccionado.value = {
    id: departamentoId,
    nombre: nombresDepartamentos[departamentoId] || `Departamento ${departamentoId}`
  }
  
  // Si es región metropolitana (19 o 20), establecer también la región seleccionada
  if (regNum === 19 || regNum === 20) {
    regionSeleccionada.value = regNum
  }
  
  // Obtener coordenadas para el zoom
  let coordenadas = coordenadasDepartamentos[departamentoId]
  
  // Para regiones metropolitanas, usar coordenadas específicas
  if (regNum === 19) {
    coordenadas = COORDENADAS_REGION_19
  } else if (regNum === 20) {
    coordenadas = COORDENADAS_REGION_20
  }
  
  // Hacer zoom al departamento/región
  if (coordenadas) {
    mapInstance.easeTo({
      center: coordenadas,
      zoom: 8.5, // Zoom más cercano para ver mejor la región
      pitch: 0,
      bearing: 0,
      padding: { top: 50, bottom: 50, left: 50, right: 300 },
      duration: 1500,
      essential: true
    })
  }
  
  // Cargar datos del departamento/región
  await cargarDatosDepartamento(departamentoId, regNum === 19 || regNum === 20 ? regNum : undefined)
  
  // Actualizar visualización
  actualizarColores()
  actualizarEtiquetas()
  actualizarPuntosRegiones()
  
  // Mostrar SOLO la región forzada y ocultar todo lo demás
  mostrarSoloRegionForzada(mapInstance, regNum, departamentoId)
}

// Función para mostrar SOLO la región forzada y ocultar todo lo demás
const mostrarSoloRegionForzada = (mapInstance: maplibregl.Map, regionId: number, departamentoId: number) => {
  // OCULTAR completamente los departamentos que no son de esta región
  // Filtrar para mostrar solo el departamento de la región
  mapInstance.setFilter('departamentos-fill', ['==', ['get', 'departamentoId'], departamentoId])
  mapInstance.setFilter('departamentos-hover', ['==', ['get', 'departamentoId'], departamentoId])
  mapInstance.setFilter('departamentos-borde', ['==', ['get', 'departamentoId'], departamentoId])
  
  // Ocultar países vecinos para una vista más limpia
  if (mapInstance.getLayer('centroamerica-fill')) {
    mapInstance.setLayoutProperty('centroamerica-fill', 'visibility', 'none')
  }
  if (mapInstance.getLayer('centroamerica-borde')) {
    mapInstance.setLayoutProperty('centroamerica-borde', 'visibility', 'none')
  }
  
  // Colorear el departamento visible
  mapInstance.setPaintProperty('departamentos-fill', 'fill-color', '#0ea5e9')
  mapInstance.setPaintProperty('departamentos-fill', 'fill-opacity', 0.9)
  
  // Ocultar TODOS los puntos de departamentos
  mapInstance.setFilter('departamentos-puntos', ['==', ['get', 'departamentoId'], -1])
  mapInstance.setFilter('departamentos-etiquetas', ['==', ['get', 'departamentoId'], -1])
  
  // Mostrar solo el punto de la región específica
  if (regionId === 5 || regionId === 20) {
    // Cortés: mostrar solo el punto de la región correspondiente
    mapInstance.setLayoutProperty('regiones-cortes-puntos', 'visibility', 'visible')
    mapInstance.setLayoutProperty('regiones-cortes-etiquetas', 'visibility', 'visible')
    mapInstance.setFilter('regiones-cortes-puntos', ['==', ['get', 'regionId'], regionId])
    mapInstance.setFilter('regiones-cortes-etiquetas', ['==', ['get', 'regionId'], regionId])
    // Asegurar que FMO esté oculto
    mapInstance.setLayoutProperty('regiones-fmo-puntos', 'visibility', 'none')
    mapInstance.setLayoutProperty('regiones-fmo-etiquetas', 'visibility', 'none')
  } else if (regionId === 8 || regionId === 19) {
    // Francisco Morazán: mostrar solo el punto de la región correspondiente
    mapInstance.setLayoutProperty('regiones-fmo-puntos', 'visibility', 'visible')
    mapInstance.setLayoutProperty('regiones-fmo-etiquetas', 'visibility', 'visible')
    mapInstance.setFilter('regiones-fmo-puntos', ['==', ['get', 'regionId'], regionId])
    mapInstance.setFilter('regiones-fmo-etiquetas', ['==', ['get', 'regionId'], regionId])
    // Asegurar que Cortés esté oculto
    mapInstance.setLayoutProperty('regiones-cortes-puntos', 'visibility', 'none')
    mapInstance.setLayoutProperty('regiones-cortes-etiquetas', 'visibility', 'none')
  } else {
    // Para regiones 1-18 (excepto 5 y 8), mostrar solo el punto del departamento
    mapInstance.setFilter('departamentos-puntos', ['==', ['get', 'departamentoId'], departamentoId])
    // Ocultar puntos de regiones metropolitanas
    mapInstance.setLayoutProperty('regiones-cortes-puntos', 'visibility', 'none')
    mapInstance.setLayoutProperty('regiones-cortes-etiquetas', 'visibility', 'none')
    mapInstance.setLayoutProperty('regiones-fmo-puntos', 'visibility', 'none')
    mapInstance.setLayoutProperty('regiones-fmo-etiquetas', 'visibility', 'none')
  }
}

const cargarDatosDepartamento = async (departamentoId: number, regionId?: number) => {
  try {
    cargandoTotales.value = true
    const params = new URLSearchParams({
      anio: String(props.anio ?? 2025),
      departamentoId: String(departamentoId),
      limite: '100'
    })
    if (regionId !== undefined && regionId !== null) {
      params.append('regionId', String(regionId))
    }
    const respuesta = await fetchApiConFallback('/api/reportes/indicadores-municipales', params)
    const resultado = await respuesta.json()
    const totales = (resultado.datos ?? {}) as Partial<TotalesDepartamento>

    datosMunicipales.value = {
      totalConsultas: Number(totales.totalConsultas ?? 0),
      enfermeraAuxiliar: Number(totales.enfermeraAuxiliar ?? 0),
      enfermeraProfesional: Number(totales.enfermeraProfesional ?? 0),
      medicinaGeneral: Number(totales.medicinaGeneral ?? 0),
      medicosEspecialistas: Number(totales.medicosEspecialistas ?? 0),
      totalUnidades: Number(totales.totalUnidades ?? 0)
    }
  } catch (err) {
    console.error('Error cargando datos del departamento:', err)
    datosMunicipales.value = null
  } finally {
    cargandoTotales.value = false
  }
}

const cargarResumenDepartamentos = async () => {
  try {
    const respuesta = await fetchApiConFallback('/api/tablero/mapahonduras')
    const cuerpo = await respuesta.json()
    const datos = Array.isArray(cuerpo.datos) ? cuerpo.datos : []
    datosDepartamentos.value = datos.map((item: Partial<DepartamentoMapa>) => ({
      departamentoId: Number(item?.departamentoId ?? 0),
      nombre: item?.nombre ? String(item.nombre) : 'Sin nombre',
      totalHistorico: Number(item?.totalHistorico ?? 0),
      total2025: Number(item?.total2025 ?? 0),
      total2024: Number(item?.total2024 ?? 0),
      total2023: Number(item?.total2023 ?? 0),
      totalUnidades: Number(item?.totalUnidades ?? 0)
    }))
  } catch (error) {
    console.error('Error cargando resumen de departamentos:', error)
    datosDepartamentos.value = []
  }
}

const construirMapa = async () => {
  cargando.value = true
  error.value = null

  try {
    await nextTick()

    if (!mapaContainer.value) {
      throw new Error('No se pudo inicializar el contenedor del mapa')
    }

    await cargarResumenDepartamentos()
    
    // Cargar GeoJSON de países vecinos
    const centroamericaUrl = buildStaticUrl('geo/centroamerica.geojson')
    const centroamericaResp = await fetch(centroamericaUrl)
    const centroamerica = centroamericaResp.ok ? await centroamericaResp.json() : null
    
    // Cargar GeoJSON de Honduras
    const geoUrl = buildStaticUrl('geo/geoBoundaries-HND-ADM1.geojson')
    const geojsonResp = await fetch(geoUrl)

    if (!geojsonResp.ok) {
      throw new Error('No se pudo cargar el GeoJSON de Honduras')
    }

    const geojson = await geojsonResp.json()

    const features = geojson.features.map((feature: FeatureDepartamento, index: number) => {
      const iso: string = feature.properties?.shapeISO ?? ''
      const departamentoId = isoToDepartamentoId[iso] ?? 0
      const totalConsultas = obtenerTotalDepartamento(departamentoId)

      return {
        ...feature,
        id: departamentoId || index, // Asignar ID único para feature-state
        properties: {
          ...feature.properties,
          departamentoId,
          totalConsultas
        }
      }
    })

    const procesado = {
      ...geojson,
      features
    }
    geojsonBase.value = procesado as GeoJSONCollection

    // Procesar GeoJSON completado

    const estilo: StyleSpecification = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        ...(centroamerica && {
          centroamerica: {
            type: 'geojson',
            data: centroamerica
          }
        }),
        honduras: {
          type: 'geojson',
          data: construirGeojsonConTotales() ?? procesado
        },
        'departamentos-centroides': {
          type: 'geojson',
          data: construirCentroidesDepartamentos() ?? { type: 'FeatureCollection', features: [] }
        },
        'regiones-cortes': {
          type: 'geojson',
          data: construirPuntosRegionesCortes()
        },
        'regiones-fmo': {
          type: 'geojson',
          data: construirPuntosRegionesFMO()
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': colorFondoMapa.value
          }
        },
        ...(centroamerica ? [
          {
            id: 'centroamerica-fill',
            type: 'fill' as const,
            source: 'centroamerica',
            paint: {
              'fill-color': '#e5e7eb',
              'fill-opacity': 0.4
            }
          },
          {
            id: 'centroamerica-borde',
            type: 'line' as const,
            source: 'centroamerica',
            paint: {
              'line-color': '#d1d5db',
              'line-width': 1
            }
          }
        ] : []),
        {
          id: 'departamentos-fill',
          type: 'fill',
          source: 'honduras',
          paint: {
            'fill-color': crearExpresionColor(),
            'fill-opacity': 0.9
          }
        },
        {
          id: 'departamentos-hover',
          type: 'fill',
          source: 'honduras',
          paint: {
            'fill-color': '#bae6fd',
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              0.85,
              0
            ]
          }
        },
        {
          id: 'departamentos-borde',
          type: 'line',
          source: 'honduras',
          paint: {
            'line-color': '#94a3b8',
            'line-width': 1.5
          }
        },
        {
          id: 'departamentos-puntos',
          type: 'circle',
          source: 'departamentos-centroides',
          paint: {
            'circle-radius': 6,
            'circle-color': '#f97316',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        },
        {
          id: 'departamentos-etiquetas',
          type: 'symbol',
          source: 'departamentos-centroides',
          filter: ['==', ['get', 'departamentoId'], -1], // Inicialmente no mostrar ninguna etiqueta
          layout: {
            'text-field': ['get', 'shapeName'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 14,
            'text-offset': [0, 1.5],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        },
        {
          id: 'regiones-cortes-puntos',
          type: 'circle',
          source: 'regiones-cortes',
          layout: {
            visibility: 'none' // Oculto por defecto, se muestra solo cuando Cortés está seleccionado
          },
          paint: {
            'circle-radius': 8,
            'circle-color': '#f59e0b', // Color por defecto (naranja)
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        },
        {
          id: 'regiones-cortes-etiquetas',
          type: 'symbol',
          source: 'regiones-cortes',
          layout: {
            visibility: 'none', // Oculto por defecto
            'text-field': ['get', 'nombre'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 12,
            'text-offset': [0, 2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        },
        {
          id: 'regiones-fmo-puntos',
          type: 'circle',
          source: 'regiones-fmo',
          layout: {
            visibility: 'none' // Oculto por defecto, se muestra solo cuando Francisco Morazán está seleccionado
          },
          paint: {
            'circle-radius': 8,
            'circle-color': '#f59e0b', // Color por defecto (naranja)
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        },
        {
          id: 'regiones-fmo-etiquetas',
          type: 'symbol',
          source: 'regiones-fmo',
          layout: {
            visibility: 'none', // Oculto por defecto
            'text-field': ['get', 'nombre'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 12,
            'text-offset': [0, 2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        }
      ]
    }

    const opciones: MapOptions = {
      container: mapaContainer.value as HTMLDivElement,
      style: estilo,
      center: [-86.25, 14.8], // Centro ajustado para incluir Islas de la Bahía
      zoom: 6.2, // Zoom inicial
      pitch: 0, // Vista plana (sin inclinación)
      bearing: 0 // Norte arriba (sin rotación)
    }

    const mapInstance = new maplibregl.Map(opciones)

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    mapa = mapInstance

    // Deshabilitar zoom con scroll para no bloquear el scroll del widget embebido
    try {
      mapInstance.scrollZoom?.disable()
    } catch (_) {
      // noop
    }

    let hoveredStateId: string | number | undefined = undefined

    mapInstance.on('load', () => {
      actualizarColores()
      actualizarFondoMapa()
      actualizarFuenteGeografica()
      
      // Si hay filtro de región forzado, aplicarlo automáticamente
      if (esFiltroForzado.value && regionForzada.value) {
        aplicarFiltroRegionForzado(mapInstance)
      }
    })

    // Capturar el estado original cuando el mapa esté completamente estable
    // El evento 'idle' se dispara cuando el mapa termina de renderizar y todas las animaciones finalizan
    mapInstance.once('idle', () => {
      if (!estadoOriginalMapa && mapInstance) {
        estadoOriginalMapa = {
          center: mapInstance.getCenter().toArray() as [number, number],
          zoom: mapInstance.getZoom(),
          pitch: mapInstance.getPitch(),
          bearing: mapInstance.getBearing()
        }
        console.log('Estado original capturado:', estadoOriginalMapa)
      }
    })

    // Efecto hover - cambiar cursor
    mapInstance.on('mouseenter', 'departamentos-fill', () => {
      mapInstance.getCanvas().style.cursor = 'pointer'
    })

    mapInstance.on('mouseleave', 'departamentos-fill', () => {
      mapInstance.getCanvas().style.cursor = ''
      if (hoveredStateId !== undefined) {
        mapInstance.setFeatureState(
          { source: 'honduras', id: hoveredStateId },
          { hover: false }
        )
        hoveredStateId = undefined
      }
    })

    // Efecto hover - cambiar color
    mapInstance.on('mousemove', 'departamentos-fill', (evento: MapLayerMouseEvent) => {
      if (evento.features && evento.features.length > 0) {
        const feature = evento.features[0]
        if (!feature) return
        
        if (hoveredStateId !== undefined) {
          mapInstance.setFeatureState(
            { source: 'honduras', id: hoveredStateId },
            { hover: false }
          )
        }
        hoveredStateId = feature.id
        if (hoveredStateId !== undefined) {
          mapInstance.setFeatureState(
            { source: 'honduras', id: hoveredStateId },
            { hover: true }
          )
        }
      }
    })

    mapInstance.on('click', 'departamentos-fill', async (evento: MapLayerMouseEvent) => {
      // Si hay filtro de región forzado, ignorar clicks en otros departamentos
      if (esFiltroForzado.value) {
        return
      }
      
      const feature = evento.features?.[0]
      if (!feature) {
        departamentoSeleccionado.value = null
        datosMunicipales.value = null
        return
      }

      const propiedades = feature.properties as {
        shapeName?: string
        departamentoId?: number
      }

      const departamentoId = propiedades.departamentoId ?? 0

      if (departamentoId) {
        departamentoIdSeleccionado.value = departamentoId as number
        departamentoSeleccionado.value = {
          id: departamentoId,
          nombre: propiedades.shapeName ?? 'Sin nombre'
        }

        // Animación de zoom al departamento seleccionado
        if (feature.geometry && feature.geometry.type === 'Polygon') {
          // Calcular el centro del polígono del departamento
          const coordinates = feature.geometry.coordinates[0] as [number, number][]
          let totalLng = 0
          let totalLat = 0

          coordinates.forEach(coord => {
            totalLng += coord[0]
            totalLat += coord[1]
          })

          const centerLng = totalLng / coordinates.length
          const centerLat = totalLat / coordinates.length

          // Animar zoom al centro del departamento usando easeTo
          // Padding ajustado para centrar el departamento en el espacio visible (lado izquierdo)
          // dejando espacio a la derecha para el panel de información
          mapInstance.easeTo({
            center: [centerLng, centerLat],
            zoom: 7.5, // Nivel de zoom para ver el departamento
            pitch: 0, // Mantener vista plana
            bearing: 0, // Mantener norte arriba
            padding: { top: 50, bottom: 50, left: 50, right: 350 }, // Más padding a la derecha para el panel
            duration: 1500, // Duración de la animación en ms
            essential: true // La animación no se puede cancelar
          })
        }

        await cargarDatosDepartamento(departamentoId)
        actualizarColores()
        actualizarEtiquetas()
        actualizarPuntosRegiones()
      }
    })

    // Click en puntos de región de Cortés
    mapInstance.on('click', 'regiones-cortes-puntos', async (evento: MapLayerMouseEvent) => {
      // Si hay filtro de región forzado, ignorar clicks
      if (esFiltroForzado.value) return
      
      const feature = evento.features?.[0]
      if (!feature) return

      const propiedades = feature.properties as {
        departamentoId?: number
        regionId?: number
        nombre?: string
      }

      const departamentoId = propiedades.departamentoId ?? 0
      const regionId = propiedades.regionId ?? 0

      if (departamentoId && regionId) {
        regionSeleccionada.value = regionId
        departamentoIdSeleccionado.value = departamentoId
        // El nombre del departamento debe ser siempre "Cortés", no el nombre de la región
        departamentoSeleccionado.value = {
          id: departamentoId,
          nombre: 'Cortés'
        }

        await cargarDatosDepartamento(departamentoId, regionId)
        actualizarPuntosRegiones()
      }
    })

    // Hover en puntos de región de Cortés
    mapInstance.on('mouseenter', 'regiones-cortes-puntos', () => {
      mapInstance.getCanvas().style.cursor = 'pointer'
    })

    mapInstance.on('mouseleave', 'regiones-cortes-puntos', () => {
      mapInstance.getCanvas().style.cursor = ''
    })

    // Click en puntos de región de Francisco Morazán
    mapInstance.on('click', 'regiones-fmo-puntos', async (evento: MapLayerMouseEvent) => {
      // Si hay filtro de región forzado, ignorar clicks
      if (esFiltroForzado.value) return
      
      const feature = evento.features?.[0]
      if (!feature) return

      const propiedades = feature.properties as {
        departamentoId?: number
        regionId?: number
        nombre?: string
      }

      const departamentoId = propiedades.departamentoId ?? 0
      const regionId = propiedades.regionId ?? 0

      if (departamentoId && regionId) {
        regionSeleccionada.value = regionId
        departamentoIdSeleccionado.value = departamentoId
        // El nombre del departamento debe ser siempre "Francisco Morazán", no el nombre de la región
        departamentoSeleccionado.value = {
          id: departamentoId,
          nombre: 'Francisco Morazán'
        }

        await cargarDatosDepartamento(departamentoId, regionId)
        actualizarPuntosRegiones()
      }
    })

    // Hover en puntos de región de Francisco Morazán
    mapInstance.on('mouseenter', 'regiones-fmo-puntos', () => {
      mapInstance.getCanvas().style.cursor = 'pointer'
    })

    mapInstance.on('mouseleave', 'regiones-fmo-puntos', () => {
      mapInstance.getCanvas().style.cursor = ''
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error desconocido al cargar el mapa'
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  esModoOscuro.value = document.documentElement.classList.contains('dark')
  observer = new MutationObserver(() => {
    esModoOscuro.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  void construirMapa()
})

onBeforeUnmount(() => {
  if (mapa) {
    mapa.remove()
    mapa = null
  }
  observer?.disconnect()
  observer = null
})

watch(datosMunicipales, () => {
  actualizarColores()
})

watch(departamentoIdSeleccionado, () => {
  actualizarColores()
})

watch(esModoOscuro, () => {
  actualizarFondoMapa()
})

watch(datosDepartamentos, () => {
  actualizarFuenteGeografica()
  actualizarColores()
})

watch(departamentoIdSeleccionado, () => {
  actualizarPuntosRegiones()
})

watch(() => props.anio, async () => {
  if (departamentoSeleccionado.value) {
    datosMunicipales.value = null
    await cargarDatosDepartamento(departamentoSeleccionado.value.id, regionSeleccionada.value ?? undefined)
  }
  actualizarFuenteGeografica()
  actualizarColores()
})
</script>

<template>
  <div
    class="relative overflow-hidden rounded-card border border-border bg-surface shadow-panel transition-colors duration-300 dark:border-border-dark dark:bg-surface-dark"
    :class="esFiltroForzado ? 'min-h-[580px]' : 'min-h-[420px]'"
  >
    <div 
      ref="mapaContainer" 
      class="w-full transition-all duration-300"
      :class="esFiltroForzado ? 'h-[620px] max-[840px]:h-[500px]' : 'h-[480px] max-[840px]:h-[360px]'"
    ></div>

    <div
      v-if="cargando"
      class="absolute inset-0 flex items-center justify-center bg-overlay-light px-4 text-center text-sm font-semibold text-text-secondary transition-colors duration-300 dark:bg-overlay-dark dark:text-text-inverted"
    >
      Cargando mapa...
    </div>
    <div
      v-else-if="error"
      class="absolute inset-0 flex items-center justify-center bg-red-500/90 px-4 text-center text-sm font-semibold text-white"
    >
      {{ error }}
    </div>

    <aside
      v-if="departamentoSeleccionado"
      class="relative mx-4 my-4 space-y-3 rounded-[14px] border border-brand-dark/20 bg-white/90 px-4 py-4 text-sm text-text-secondary shadow-[0_12px_18px_rgba(12,74,110,0.15)] backdrop-blur transition-colors duration-300 dark:border-border-dark/60 dark:bg-surface-dark/95 dark:text-text-muted md:absolute md:bottom-4 md:right-48 md:mx-0 md:my-0 md:w-[280px] md:px-5 md:py-4"
    >
      <!-- Spinner de carga en esquina superior derecha -->
      <div
        v-if="cargandoTotales"
        class="absolute top-2 right-2 z-10"
      >
        <div class="w-4 h-4 border-2 border-brand-base border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div class="space-y-1">
        <h3 class="text-lg font-semibold text-primary transition-colors duration-300 dark:text-text-inverted">
          {{ departamentoSeleccionado.nombre }}
        </h3>
        <p class="text-xs text-gray-600 dark:text-gray-400">
          {{ regionSeleccionada ? (regionSeleccionada === 5 ? 'Cortés' : regionSeleccionada === 20 ? 'Metropolitana de San Pedro Sula' : regionSeleccionada === 8 ? 'Francisco Morazán' : regionSeleccionada === 19 ? 'Metropolitana del Distrito Central' : '') : `Departamental de ${departamentoSeleccionado.nombre}` }}
        </p>
      </div>

      <!-- Mostrar datos solo cuando están disponibles -->
      <div v-if="datosMunicipales" class="space-y-2">
        <div>
          <span class="text-lg font-bold text-brand-base transition-colors duration-300 dark:text-brand-light">
            {{ totalesDepartamento.totalConsultas.toLocaleString('es-HN') }}
          </span>
          <span class="text-xs text-gray-600 dark:text-gray-400 ml-1">
            consultas totales ({{ props.anio ?? 'Total' }})
          </span>
        </div>

        <div class="space-y-1 text-xs">
          <div>• Enfermera Auxiliar: {{ totalesDepartamento.enfermeraAuxiliar.toLocaleString('es-HN') }}</div>
          <div>• Enfermera Profesional: {{ totalesDepartamento.enfermeraProfesional.toLocaleString('es-HN') }}</div>
          <div>• Med. General: {{ totalesDepartamento.medicinaGeneral.toLocaleString('es-HN') }}</div>
          <div>• Centros salud: {{ totalesDepartamento.totalUnidades }}</div>
        </div>
      </div>
    </aside>


    <!-- Indicador de filtro de región forzado -->
    <div 
      v-if="esFiltroForzado" 
      class="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg border-2 border-amber-400/50 bg-amber-50/95 dark:border-amber-600/50 dark:bg-amber-900/90 px-3 py-2 shadow-lg backdrop-blur"
    >
      <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span class="text-xs font-semibold text-amber-800 dark:text-amber-200">
        {{ nombreRegionForzada }}
      </span>
    </div>

    <!-- Chips de años -->
    <div class="absolute top-4 left-4 right-4 flex flex-wrap gap-2 justify-center" :class="{ 'pl-48': esFiltroForzado }">
      <button
        v-for="item in aniosDisponibles"
        :key="item.etiqueta"
        @click="seleccionarAnio(item)"
        :class="[
          'px-3 py-1 text-xs font-medium rounded-full transition-all duration-200',
          (item.valor === null && totalSeleccionado) || (item.valor !== null && item.valor === props.anio && !totalSeleccionado)
            ? 'bg-brand-base text-white shadow-md'
            : 'bg-white/90 text-gray-700 hover:bg-gray-100 dark:bg-surface-dark/90 dark:text-gray-300 dark:hover:bg-gray-700'
        ]"
      >
        {{ item.etiqueta }}
      </button>
    </div>

    <!-- Controles inferiores - Ocultar cuando hay filtro forzado -->
    <div v-if="!esFiltroForzado" class="absolute bottom-4 left-4 right-4 flex justify-center">
      <button
        @click="volverVistaGeneral"
        :disabled="!departamentoSeleccionado"
        class="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-md transition-all hover:bg-gray-100 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed dark:bg-surface-dark/90 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Volver a vista general de Honduras"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <span class="hidden sm:inline">Vista general</span>
      </button>
    </div>
  </div>
</template>
