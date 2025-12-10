<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import maplibregl from 'maplibre-gl'
import type { MapOptions, StyleSpecification } from 'maplibre-gl'
// eslint-disable-next-line import/no-unresolved
import MapLibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker'
import 'maplibre-gl/dist/maplibre-gl.css'

;(maplibregl as typeof maplibregl & { workerClass?: typeof Worker }).workerClass =
  MapLibreWorker as unknown as typeof Worker

const mapaContainer = ref<HTMLDivElement | null>(null)
const cargando = ref<boolean>(true)
const error = ref<string | null>(null)
let mapa: maplibregl.Map | null = null
const esModoOscuro = ref<boolean>(false)
let observer: MutationObserver | null = null

const colorFondoMapa = computed(() => (esModoOscuro.value ? '#0d1b32' : '#f4f8ff'))

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

const actualizarFondoMapa = () => {
  if (!mapa) return
  mapa.setPaintProperty('background', 'background-color', colorFondoMapa.value)
}

const construirMapa = async () => {
  cargando.value = true
  error.value = null

  try {
    await nextTick()

    if (!mapaContainer.value) {
      throw new Error('No se pudo inicializar el contenedor del mapa')
    }
    
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
          data: geojson
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
            'fill-color': '#ffffff',
            'fill-opacity': 0.9
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
        }
      ]
    }

    const opciones: MapOptions = {
      container: mapaContainer.value as HTMLDivElement,
      style: estilo,
      center: [-86.25, 14.8],
      zoom: 6.2,
      pitch: 0,
      bearing: 0
    }

    const mapInstance = new maplibregl.Map(opciones)

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    mapa = mapInstance

    // Deshabilitar zoom con scroll
    try {
      mapInstance.scrollZoom?.disable()
    } catch (_) {
      // noop
    }

    mapInstance.on('load', () => {
      actualizarFondoMapa()
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

watch(esModoOscuro, () => {
  actualizarFondoMapa()
})
</script>

<template>
  <div
    class="relative min-h-[420px] overflow-hidden rounded-card border border-border bg-surface shadow-panel transition-colors duration-300 dark:border-border-dark dark:bg-surface-dark"
  >
    <div ref="mapaContainer" class="h-[480px] w-full max-[840px]:h-[360px]"></div>

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
  </div>
</template>

