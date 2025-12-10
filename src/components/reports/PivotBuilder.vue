<template>
  <div class="grid gap-6 text-slate-900 dark:text-slate-100 min-w-0">
    <!-- Indicador de filtro de región forzado -->
    <div 
      v-if="esFiltroForzado" 
      class="flex items-center gap-3 rounded-xl border-2 border-amber-400/50 bg-amber-50 dark:border-amber-600/50 dark:bg-amber-900/20 p-4 shadow-panel"
    >
      <div class="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50">
        <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Filtro de región activo
        </p>
        <p class="text-xs text-amber-700 dark:text-amber-300">
          Los reportes están filtrados a: <strong>{{ nombreRegionForzada }}</strong>
        </p>
      </div>
    </div>

    <!-- Selector de Años (múltiple) -->
    <section class="flex items-center gap-4 rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark p-4 shadow-panel mb-6">
      <div class="flex items-center gap-4 flex-wrap">
        <label class="text-sm font-medium text-secondary dark:text-text-muted">
          Años de consulta:
        </label>
        <MultiSelect
          label=""
          placeholder="Seleccionar años"
          :options="opcionesAnios"
          :model-value="aniosSeleccionados"
          field="ANIOS"
          :disabled="estado.cargando"
          @update:model-value="onAniosChange"
        />
        <span v-if="aniosSeleccionados.length > 0" class="text-xs text-slate-500 dark:text-slate-400">
          <template v-if="aniosSeleccionados.length === 1">
            Datos del año {{ aniosSeleccionados[0] }}
          </template>
          <template v-else>
            {{ aniosSeleccionados.length }} años seleccionados
          </template>
        </span>
        <div v-if="aniosSeleccionados.length > 5 && !estado.cargando" class="relative group">
          <span class="text-xs text-amber-600 dark:text-amber-400 cursor-help">
            ⚠️ Consultas con {{ aniosSeleccionados.length }} años pueden tardar más tiempo
          </span>
          <!-- Tooltip -->
          <div class="absolute bottom-full left-0 mb-2 hidden w-64 rounded-lg bg-slate-900 p-3 text-xs text-white shadow-lg group-hover:block z-50">
            <div class="flex items-start gap-2">
              <span class="text-amber-400">⚠️</span>
              <div>
                <p class="font-medium mb-1">Tiempo estimado de carga:</p>
                <p class="text-slate-300">
                  {{ aniosSeleccionados.length === 6 ? '~30 segundos' : 
                     aniosSeleccionados.length === 7 ? '~45 segundos' :
                     aniosSeleccionados.length === 8 ? '~1 minuto' :
                     aniosSeleccionados.length === 9 ? '~1 minuto 15 segundos' :
                     aniosSeleccionados.length === 10 ? '~1 minuto 30 segundos' :
                     aniosSeleccionados.length === 11 ? '~1 minuto 45 segundos' :
                     aniosSeleccionados.length === 12 ? '~2 minutos' :
                     aniosSeleccionados.length === 13 ? '~2 minutos 15 segundos' :
                     aniosSeleccionados.length === 14 ? '~2 minutos 30 segundos' :
                     aniosSeleccionados.length === 15 ? '~2 minutos 45 segundos' :
                     aniosSeleccionados.length === 16 ? '~3 minutos' :
                     aniosSeleccionados.length === 17 ? '~3 minutos 15 segundos' :
                     aniosSeleccionados.length >= 18 ? '~3 minutos 30 segundos' : '' }}
                </p>
                <p class="text-xs text-slate-400 mt-2">El sistema procesará ~{{ aniosSeleccionados.length }} millón(es) de registros</p>
              </div>
            </div>
            <!-- Flecha del tooltip -->
            <div class="absolute top-full left-4 -mt-1">
              <div class="border-4 border-transparent border-t-slate-900"></div>
            </div>
          </div>
        </div>
        <span v-if="estado.cargando" class="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
          <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Cargando... espera para cambiar años
        </span>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-3 rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark p-4 shadow">
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">Dimensiones</h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            v-for="dimension in dimensionesFiltradas"
            :key="dimension.id"
            class="flex items-center justify-between gap-3 rounded-md border border-orange-200 bg-white dark:border-orange-700 dark:bg-slate-800 px-3 py-2 text-sm text-primary dark:text-text-inverted shadow-sm transition hover:border-orange-400 hover:shadow-md cursor-move"
            draggable="true"
            @dragstart="handleDragStart($event, 'dimension', dimension.id)"
            tabindex="0"
            role="button"
            :aria-label="`Arrastrar dimensión ${dimension.etiqueta}`"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-slate-900 dark:text-slate-100">{{ dimension.etiqueta }}</span>
            </div>
            <span
              class="inline-flex items-center rounded-md bg-orange-500 dark:bg-orange-600 px-2.5 py-1 text-xs font-semibold capitalize text-white shadow-sm"
            >
              {{ dimension.tipo === 'number' ? 'Numérica' : 'Texto' }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark p-4 shadow">
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">Métricas</h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            v-for="medida in medidasFiltradas"
            :key="medida.id"
            class="flex items-center justify-between gap-3 rounded-md border border-orange-200 bg-white dark:border-orange-700 dark:bg-slate-800 px-3 py-2 text-sm text-primary dark:text-text-inverted shadow-sm transition hover:border-orange-400 hover:shadow-md cursor-move"
            draggable="true"
            @dragstart="handleDragStart($event, 'measure', medida.id)"
            tabindex="0"
            role="button"
            :aria-label="`Arrastrar métrica ${medida.etiqueta}`"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-slate-900 dark:text-slate-100">{{ medida.etiqueta }}</span>
            </div>
            <span
              class="inline-flex items-center rounded-md bg-orange-500 dark:bg-orange-600 px-2.5 py-1 text-xs font-semibold capitalize text-white shadow-sm"
            >
              {{ formatearAgregacion(medida.agregacionPorDefecto) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PivotDropZone
        titulo="Filtros"
        descripcion=""
        :items="filtros"
        :zone-id="'filters'"
        @remove="removerFiltro"
        @drop="handleDropFiltros"
      />
      <PivotDropZone
        titulo="Columnas"
        descripcion=""
        :items="columnas"
        :zone-id="'columns'"
        @remove="removerColumna"
        @drop="handleDropColumnas"
      />
      <PivotDropZone
        titulo="Filas"
        descripcion=""
        :items="filas"
        :zone-id="'rows'"
        @remove="removerFila"
        @drop="handleDropFilas"
      />
      <PivotDropZone
        titulo="Valores"
        descripcion=""
        :items="valores"
        :zone-id="'values'"
        @remove="removerValor"
        @drop="handleDropValores"
      />
    </section>

    <section
      v-if="visibleFilters.length"
      class="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark p-4 shadow mb-6"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">Filtros Aplicados</h3>
        <button
          @click="limpiarTodosLosFiltros"
          class="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          title="Limpiar todos los filtros"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          Limpiar Filtros
        </button>
      </div>
      <div class="flex flex-wrap gap-4">
        <MultiSelect
          v-for="filtro in visibleFilters"
          :key="filtro.field"
          :label="filtro.label"
          :options="filtro.options"
          :model-value="filtro.seleccionados"
          :field="filtro.field"
          :placeholder="filtro.field === 'ESTABLECIMIENTO' ? 'nombre, código' : 'Buscar opción'"
          @update:model-value="(valores) => handleFilterChange(filtro.field, valores)"
        />
      </div>
    </section>

    <section class="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark p-4 shadow overflow-hidden">
      <PivotPreview
        :resultado="resultado"
        :cargando="estado.cargando"
        :error="estado.error"
        :progreso="estado.progreso"
        :mensaje-progreso="estado.mensajeProgreso"
      />
    </section>

    <!-- Modal de errores amigable -->
    <ErrorModal
      :error="errorModal"
      :visible="mostrarErrorModal"
      @cerrar="cerrarErrorModal"
      @reintentar="reintentarDesdeModal"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import type { PivotCatalogo, PivotQueryPayload, PivotQueryResult } from "../../types/pivot";
import { 
  consultarPivotApi, 
  obtenerCatalogoPivotApi, 
  obtenerValoresDimensionApi,
  cancelarConsultaPivot,
  isAbortError,
  type PivotError
} from "../../services/pivot";
import { buildDragData, parseDragData } from "../../utils/drag";
import type { DragData } from "../../utils/drag";
import type { PivotFilterState } from "../../types/pivot";
import { debounce, DEBOUNCE_TIMES } from "../../utils/request.utils";
import PivotDropZone from "./PivotDropZone.vue";
import PivotPreview from "./PivotPreview.vue";
import MultiSelect from "../common/MultiSelect.vue";
import ErrorModal from "../common/ErrorModal.vue";
import { useApiBase } from "../../composables/useApiBase";
import { useRegionFilter } from "../../composables/useRegionFilter";

const catalogo = reactive<PivotCatalogo>({ dimensiones: [], medidas: [], actualizadoEn: "" });
const apiBase = useApiBase();

// Filtro de región global (desde URL ?reg=X)
const { regionForzada, esFiltroForzado, nombreRegionForzada } = useRegionFilter();

const filtros = ref<string[]>([]);
const columnas = ref<string[]>([]);
const filas = ref<string[]>([]);
const valores = ref<string[]>(["TOTAL"]);
const busqueda = ref("");

// Variables para el selector de años (múltiple)
const aniosDisponibles = ref<number[]>([]);
const aniosSeleccionados = ref<number[]>([2025]);
const cargandoAnios = ref(false);

const estado = reactive({
  cargando: false,
  error: "",
  progreso: 0,
  mensajeProgreso: "Preparando consulta..."
});

// Estado para el modal de errores
const errorModal = ref<PivotError | null>(null);
const mostrarErrorModal = ref(false);

const cerrarErrorModal = () => {
  mostrarErrorModal.value = false;
  errorModal.value = null;
};

const reintentarDesdeModal = () => {
  cerrarErrorModal();
  void consultarPivot();
};

let progresoResetTimeout: number | null = null;
const esperar = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const resultado = ref<{ resultado: PivotQueryResult; generadoEn: string } | null>(null);
const filtrosInteractivos = reactive<Record<string, PivotFilterState>>({});

const formatearAgregacion = (agregacion: string) => {
  switch (agregacion) {
    case "SUM":
      return "Suma";
    case "COUNT":
      return "Conteo";
    case "AVG":
      return "Promedio";
    case "MAX":
      return "Máximo";
    case "MIN":
      return "Mínimo";
    default:
      return agregacion;
  }
};


const payloadConsulta = computed<PivotQueryPayload>(() => {
  const filtrosSeleccionados = filtros.value.map((dimensionId) => ({
    field: dimensionId,
    values: filtrosInteractivos[dimensionId]?.seleccionados
  }));

  // DEBUG: Log del filtro de región
  console.log('[PivotBuilder] Región forzada:', regionForzada.value)

  // Si hay filtro de región forzado por URL, agregarlo automáticamente
  if (regionForzada.value) {
    // Verificar si ya existe un filtro de REGION
    const existeFiltroRegion = filtrosSeleccionados.some(f => f.field === 'REGION');
    if (!existeFiltroRegion) {
      // Agregar el filtro de región forzado
      filtrosSeleccionados.push({
        field: 'REGION',
        values: [regionForzada.value]
      });
    } else {
      // Si ya existe, sobrescribir con el valor forzado
      const filtroRegion = filtrosSeleccionados.find(f => f.field === 'REGION');
      if (filtroRegion) {
        filtroRegion.values = [regionForzada.value];
      }
    }
  }

  const filasSeleccionadas = [...filas.value];
  const columnasSeleccionadas = [...columnas.value];

  // Mover a columnas/filas cuando el usuario selecciona más de un valor
  const filtrosParaDesglosar = filtros.value.filter((dimensionId) => {
    if (filasSeleccionadas.includes(dimensionId) || columnasSeleccionadas.includes(dimensionId)) {
      return false;
    }
    const configuracion = filtrosInteractivos[dimensionId];
    if (!configuracion) return false;
    const seleccionados = configuracion.seleccionados ?? [];
    return seleccionados.length > 1;
  });

  filtrosParaDesglosar.forEach((dimensionId) => {
    if (columnasSeleccionadas.length <= filasSeleccionadas.length) {
      columnasSeleccionadas.push(dimensionId);
    } else {
      filasSeleccionadas.push(dimensionId);
    }
  });

  // Construir filtros finales: mantener los filtros que NO están en filas/columnas
  // PERO también agregar filtros para las dimensiones que están en filas/columnas pero tienen valores seleccionados
  const filtrosFinales = filtrosSeleccionados.filter(
    (filtro) => !filasSeleccionadas.includes(filtro.field) && !columnasSeleccionadas.includes(filtro.field)
  );

  // Agregar filtros para dimensiones que están en filas/columnas pero tienen valores seleccionados
  // Esto asegura que solo se muestren los valores seleccionados, no todos los posibles
  // Lógica dinámica: siempre agregar el filtro si hay valores seleccionados, independientemente del número
  [...filasSeleccionadas, ...columnasSeleccionadas].forEach((dimensionId) => {
    const configuracion = filtrosInteractivos[dimensionId];
    if (configuracion?.seleccionados?.length) {
      const seleccionados = configuracion.seleccionados ?? [];
      const debeFiltrar = seleccionados.length > 0;

      if (debeFiltrar) {
        // Verificar que no esté ya en filtrosFinales (evitar duplicados)
        const yaExiste = filtrosFinales.some(f => f.field === dimensionId);
        if (!yaExiste) {
          filtrosFinales.push({
            field: dimensionId,
            values: seleccionados
          });
        }
      }
    }
  });

  return {
    years: aniosSeleccionados.value,
    filters: filtrosFinales,
    rows: filasSeleccionadas,
    columns: columnasSeleccionadas,
    values: valores.value.map((valorId) => ({ field: valorId })),
    includeTotals: true
  };
});

const dimensionesFiltradas = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  let dimensiones = catalogo.dimensiones;
  
  // Si hay filtro de región forzado, ocultar la dimensión REGION del catálogo
  if (esFiltroForzado.value) {
    dimensiones = dimensiones.filter(
      (dimension: any) => dimension.id !== 'REGION' && dimension.id !== 'region'
    );
  }
  
  if (!texto) return dimensiones;
  return dimensiones.filter(
    (dimension: any) =>
      dimension.etiqueta.toLowerCase().includes(texto) || dimension.id.toLowerCase().includes(texto)
  );
});

const medidasFiltradas = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  if (!texto) return catalogo.medidas;
  return catalogo.medidas.filter(
    (medida: any) =>
      medida.etiqueta.toLowerCase().includes(texto) || medida.id.toLowerCase().includes(texto)
  );
});

// Filtros visibles: solo los que NO están bloqueados
const visibleFilters = computed(() => 
  Object.values(filtrosInteractivos).filter(filtro => !filtro.bloqueado)
);

// Función para convertir número de mes a nombre del mes
const obtenerNombreMes = (numeroMes: number | string): string => {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const num = typeof numeroMes === 'string' ? parseInt(numeroMes, 10) : numeroMes;
  if (num >= 1 && num <= 12) {
    const nombreMes = meses[num - 1];
    return nombreMes ?? String(numeroMes);
  }
  return String(numeroMes);
};

const cargarOpcionesFiltro = async (field: string) => {
  const dimension = catalogo.dimensiones.find((dim) => dim.id === field);
  if (!dimension) return;

  const filtroActual = filtrosInteractivos[field];
  const esMes = field === 'MES' || field === 'mes';
  
  if (dimension.valores) {
    filtrosInteractivos[field] = {
      field,
      label: dimension.etiqueta,
      options: dimension.valores.map((valor) => ({
        valor: valor.valor,
        etiqueta: esMes ? obtenerNombreMes(valor.valor) : valor.etiqueta
      })),
      seleccionados: filtroActual?.seleccionados ?? []
    };
    return;
  }

  if (dimension.endpointValores) {
    // Para ESTABLECIMIENTO usar límite mayor (hay ~1753 establecimientos)
    const limiteRequerido = field === 'ESTABLECIMIENTO' ? 2000 : 200;
    
    // Determinar el filtro de región a usar:
    // 1. Si hay filtro forzado por URL, usar ese siempre
    // 2. Si no, usar el seleccionado manualmente en filtrosInteractivos
    let filtroRegion: string | undefined = undefined;
    
    // Prioridad 1: Filtro forzado por URL
    if (regionForzada.value) {
      filtroRegion = regionForzada.value;
    }
    // Prioridad 2: Filtro seleccionado manualmente
    else if (filtrosInteractivos['REGION']?.seleccionados?.length) {
      const regionSeleccionada = filtrosInteractivos['REGION'].seleccionados[0];
      filtroRegion = String(regionSeleccionada);
    }
    
    // Si es MUNICIPIO, aplicar el filtro de región
    if (field === 'MUNICIPIO' && filtroRegion) {
      console.log('[PivotBuilder] Cargando municipios filtrados por región:', filtroRegion);
    }
    
    // Si es ESTABLECIMIENTO, aplicar lógica de prioridad: Municipio > Región
    let filtroMunicipio: string | undefined = undefined;
    if (field === 'ESTABLECIMIENTO') {
      // Prioridad 1: Si hay MUNICIPIO seleccionado, filtrar por municipio
      if (filtrosInteractivos['MUNICIPIO']?.seleccionados?.length) {
        const municipioSeleccionado = filtrosInteractivos['MUNICIPIO'].seleccionados[0];
        filtroMunicipio = String(municipioSeleccionado);
      }
      // Prioridad 2: Si NO hay municipio pero SÍ hay filtro de región, filtrar por región
      // (filtroRegion ya está establecido arriba con la prioridad correcta)
    }
    
    const respuesta = await obtenerValoresDimensionApi(field, undefined, limiteRequerido, apiBase.value, filtroRegion, filtroMunicipio);
    filtrosInteractivos[field] = {
      field,
      label: dimension.etiqueta,
      options: respuesta.valores.map((valor: any) => ({
        valor: valor.valor,
        etiqueta: esMes ? obtenerNombreMes(valor.valor) : (valor.etiqueta || String(valor.valor))
      })),
      seleccionados: filtroActual?.seleccionados ?? []
    };
  }
};

watch(
  filtros,
  async (nuevosFiltros, anteriores) => {
    for (const field of nuevosFiltros) {
      if (!filtrosInteractivos[field]) {
        await cargarOpcionesFiltro(field);
      }
    }

    const activos = new Set(nuevosFiltros);
    Object.keys(filtrosInteractivos).forEach((field) => {
      if (!activos.has(field)) {
        delete filtrosInteractivos[field];
      }
    });

    const removidos = anteriores.filter((field) => !activos.has(field));
    if (nuevosFiltros.length || removidos.length) {
      void consultarPivot();
    }
  },
  { deep: true }
);

// Watch para recargar municipios cuando cambie la región seleccionada
watch(
  () => filtrosInteractivos['REGION']?.seleccionados,
  async (nuevaRegion, regionAnterior) => {
    // Si MUNICIPIO ya está cargado y cambió la región, recargar municipios
    if (filtrosInteractivos['MUNICIPIO'] && filtros.value.includes('MUNICIPIO')) {
      // Solo recargar si realmente cambió la región
      const regionCambio = JSON.stringify(nuevaRegion) !== JSON.stringify(regionAnterior);
      if (regionCambio) {
        await cargarOpcionesFiltro('MUNICIPIO');
        // Limpiar selección de municipios si había alguna (opcional, puedes comentar esta línea si prefieres mantener la selección)
        // filtrosInteractivos['MUNICIPIO'].seleccionados = [];
      }
    }
    
    // Si ESTABLECIMIENTO ya está cargado y cambió la región, recargar establecimientos
    // Solo si NO hay municipio seleccionado (porque municipio tiene prioridad)
    if (filtrosInteractivos['ESTABLECIMIENTO'] && filtros.value.includes('ESTABLECIMIENTO')) {
      const noHayMunicipio = !filtrosInteractivos['MUNICIPIO']?.seleccionados?.length;
      if (noHayMunicipio) {
        const regionCambio = JSON.stringify(nuevaRegion) !== JSON.stringify(regionAnterior);
        if (regionCambio) {
          await cargarOpcionesFiltro('ESTABLECIMIENTO');
        }
      }
    }
  },
  { deep: true }
);

// Watch para recargar establecimientos cuando cambie el municipio seleccionado
watch(
  () => filtrosInteractivos['MUNICIPIO']?.seleccionados,
  async (nuevoMunicipio, municipioAnterior) => {
    // Si ESTABLECIMIENTO ya está cargado y cambió el municipio, recargar establecimientos
    if (filtrosInteractivos['ESTABLECIMIENTO'] && filtros.value.includes('ESTABLECIMIENTO')) {
      // Solo recargar si realmente cambió el municipio
      const municipioCambio = JSON.stringify(nuevoMunicipio) !== JSON.stringify(municipioAnterior);
      if (municipioCambio) {
        await cargarOpcionesFiltro('ESTABLECIMIENTO');
      }
    }
  },
  { deep: true }
);

const handleFilterChange = (field: string, valores: Array<string | number>) => {
  const dimension = catalogo.dimensiones.find((dim) => dim.id === field);
  if (!dimension) return;

  const normalizados = dimension.tipo === "number"
    ? valores.map((valor) => Number(valor)).filter((numero) => Number.isFinite(numero))
    : valores;

  if (!filtrosInteractivos[field]) {
    filtrosInteractivos[field] = {
      field,
      label: dimension.etiqueta,
      options: [],
      seleccionados: normalizados
    };
  } else {
    filtrosInteractivos[field].seleccionados = normalizados;
  }

  void consultarPivot();
};

const cargarCatalogo = async () => {
  try {
    estado.error = "";
    const respuesta = await obtenerCatalogoPivotApi(apiBase.value);
    // Filtrar la dimensión ANIO para que no aparezca en el catálogo
    catalogo.dimensiones = respuesta.dimensiones.filter(
      (dimension: any) => dimension.id !== 'ANIO' && dimension.id !== 'anio'
    );
    catalogo.medidas = respuesta.medidas;
    catalogo.actualizadoEn = respuesta.actualizadoEn;
  } catch (error) {
    estado.error = error instanceof Error ? error.message : "No se pudo cargar el catálogo";
  }
};

const cargarAniosDisponibles = async () => {
  try {
    cargandoAnios.value = true;
    const response = await fetch(new URL("/api/pivot/anios", apiBase.value).toString());
    const data = await response.json();
    aniosDisponibles.value = data.anios || [];
    
    // Si no hay años disponibles, usar 2025 por defecto
    if (aniosDisponibles.value.length === 0) {
      aniosDisponibles.value = [2025];
    }
    
    // Si ninguno de los años seleccionados está en la lista, usar el más reciente
    const aniosValidos = aniosSeleccionados.value.filter(a => aniosDisponibles.value.includes(a));
    if (aniosValidos.length === 0) {
      aniosSeleccionados.value = [aniosDisponibles.value[0] ?? 2025];
    } else {
      aniosSeleccionados.value = aniosValidos;
    }
  } catch (error) {
    console.error('Error cargando años disponibles:', error);
    aniosDisponibles.value = [2025];
  } finally {
    cargandoAnios.value = false;
  }
};

// Nota: La consulta se ejecuta directamente en onAniosChange para evitar
// llamadas redundantes y mantener el código más limpio

const actualizarProgreso = (valor: number, mensaje: string) => {
  estado.progreso = Math.max(0, Math.min(100, Math.round(valor)));
  estado.mensajeProgreso = mensaje;
};

// Intervalo para progreso continuo durante la carga
let progresoInterval: number | null = null;

// Mensajes de progreso según el porcentaje - incluye info de años seleccionados
const obtenerMensajeProgreso = (progreso: number): string => {
  const numAnios = aniosSeleccionados.value.length;
  const aniosTexto = numAnios === 1 
    ? `año ${aniosSeleccionados.value[0]}` 
    : `${numAnios} años`;
  
  const tiempoEstimado = numAnios > 5 ? " (esto puede tardar unos minutos)" : "";
  
  if (progreso < 10) return `Preparando consulta para ${aniosTexto}...`;
  if (progreso < 25) return `Conectando a base de datos...`;
  if (progreso < 50) return `Consultando ${aniosTexto}${tiempoEstimado}...`;
  if (progreso < 70) return `Procesando ~${numAnios} millón(es) de registros...`;
  if (progreso < 85) return "Agregando y calculando totales...";
  if (progreso < 95) return "Generando tabla de resultados...";
  return "Finalizando...";
};

// Inicia el progreso continuo que avanza gradualmente
const iniciarProgresoContinuo = () => {
  let progresoActual = 5;
  // Velocidad base ajustada según cantidad de años
  const numAnios = aniosSeleccionados.value.length;
  const velocidadBase = numAnios > 5 ? 500 : numAnios > 3 ? 300 : 200; // ms entre incrementos
  
  // Limpiar intervalo anterior si existe
  if (progresoInterval) {
    window.clearInterval(progresoInterval);
  }
  
  actualizarProgreso(progresoActual, obtenerMensajeProgreso(progresoActual));
  
  progresoInterval = window.setInterval(() => {
    // El progreso avanza más lento conforme se acerca al 90%
    // Nunca llega a 100% hasta que la consulta termine
    // Ajustar velocidad según cantidad de años
    const incremento = numAnios > 5 ? 0.3 : numAnios > 3 ? 0.5 : 1;
    
    if (progresoActual < 30) {
      progresoActual += incremento * 2;
    } else if (progresoActual < 60) {
      progresoActual += incremento;
    } else if (progresoActual < 80) {
      progresoActual += incremento * 0.5;
    } else if (progresoActual < 90) {
      progresoActual += incremento * 0.2;
    }
    // No pasar de 90% hasta que termine
    progresoActual = Math.min(progresoActual, 90);
    actualizarProgreso(progresoActual, obtenerMensajeProgreso(progresoActual));
  }, velocidadBase);
};

// Detiene el progreso continuo
const detenerProgresoContinuo = () => {
  if (progresoInterval) {
    window.clearInterval(progresoInterval);
    progresoInterval = null;
  }
};

// Función interna de consulta (sin debounce)
const ejecutarConsultaPivot = async () => {
  try {
    estado.cargando = true;
    estado.error = "";
    if (progresoResetTimeout) {
      window.clearTimeout(progresoResetTimeout);
      progresoResetTimeout = null;
    }

    // Iniciar progreso continuo
    iniciarProgresoContinuo();

    // Ejecutar la consulta real
    const respuesta = await consultarPivotApi(payloadConsulta.value, apiBase.value);

    // Detener progreso continuo y completar
    detenerProgresoContinuo();
    
    actualizarProgreso(95, "Renderizando resultados...");
    await esperar(100);

    resultado.value = respuesta;
    actualizarProgreso(100, "Reporte generado correctamente.");
  } catch (error) {
    detenerProgresoContinuo();
    // Ignorar errores de cancelación (el usuario inició otra consulta)
    if (isAbortError(error)) {
      return;
    }
    
    // Verificar si es un error estructurado (PivotError)
    if (error && typeof error === 'object' && 'tipo' in error) {
      const pivotError = error as PivotError;
      errorModal.value = pivotError;
      mostrarErrorModal.value = true;
      estado.error = ""; // No mostrar error en el preview, solo en el modal
    } else {
      estado.error = error instanceof Error ? error.message : "No se pudo ejecutar la consulta";
    }
    actualizarProgreso(0, "No se pudo generar el reporte.");
  } finally {
    estado.cargando = false;
    progresoResetTimeout = window.setTimeout(() => {
      actualizarProgreso(0, "Preparando consulta...");
      progresoResetTimeout = null;
    }, 1500); // Mantener mensaje de éxito visible más tiempo
  }
};

// Consulta con debounce para evitar múltiples llamadas rápidas
const consultarPivot = debounce(ejecutarConsultaPivot, DEBOUNCE_TIMES.PIVOT_QUERY);

const handleDragStart = (event: DragEvent, tipo: "dimension" | "measure", id: string) => {
  if (!event.dataTransfer) return;
  
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", buildDragData(tipo, id));
  
  // Crear una imagen de arrastre personalizada
  const dragImage = document.createElement("div");
  dragImage.textContent = id;
  dragImage.style.position = "absolute";
  dragImage.style.top = "-1000px";
  dragImage.style.padding = "8px 12px";
  dragImage.style.background = "#f97316";
  dragImage.style.color = "#ffffff";
  dragImage.style.borderRadius = "6px";
  dragImage.style.fontSize = "14px";
  dragImage.style.fontWeight = "500";
  document.body.appendChild(dragImage);
  
  event.dataTransfer.setDragImage(dragImage, 0, 0);
  
  // Limpiar la imagen temporal después del drag
  setTimeout(() => {
    document.body.removeChild(dragImage);
  }, 0);
};

const handleDropFiltros = (event: DragEvent) => {
  const data = parseDragData(event.dataTransfer?.getData("text/plain"));
  if (!data) return;

  handleMoveToZone({ data, targetZone: "filters" });
};

const handleDropColumnas = (event: DragEvent) => {
  const data = parseDragData(event.dataTransfer?.getData("text/plain"));
  if (!data) return;

  handleMoveToZone({ data, targetZone: "columns" });
};

const handleDropFilas = (event: DragEvent) => {
  const data = parseDragData(event.dataTransfer?.getData("text/plain"));
  if (!data) return;

  handleMoveToZone({ data, targetZone: "rows" });
};

const handleDropValores = (event: DragEvent) => {
  const data = parseDragData(event.dataTransfer?.getData("text/plain"));
  if (!data) return;

  handleMoveToZone({ data, targetZone: "values" });
};

type ZoneId = "filters" | "columns" | "rows" | "values";

const obtenerZonaRef = (zone: ZoneId): typeof filtros => {
  switch (zone) {
    case "filters":
      return filtros;
    case "columns":
      return columnas;
    case "rows":
      return filas;
    case "values":
      return valores;
    default:
      return filtros;
  }
};

const handleMoveToZone = ({ data, targetZone }: { data: DragData; targetZone: ZoneId }) => {
  const targetRef = obtenerZonaRef(targetZone);
  const sourceZone = data.fromZone ? (data.fromZone as ZoneId) : undefined;
  const sourceRef = sourceZone ? obtenerZonaRef(sourceZone) : undefined;

  const isValidMove =
    (targetZone === "values" && data.tipo === "measure") ||
    (targetZone !== "values" && data.tipo === "dimension");

  if (!isValidMove) {
    return;
  }

  if (sourceRef) {
    const sourceIndex =
      data.fromIndex ?? sourceRef.value.findIndex((dimensionId: string) => dimensionId === data.id);
    if (sourceIndex !== -1) {
      sourceRef.value.splice(sourceIndex, 1);
    }
  }

  const targetAlreadyHas = targetRef.value.includes(data.id);
  if (!targetAlreadyHas) {
    targetRef.value = [...targetRef.value, data.id];
  }

  void consultarPivot();
};

const removerFiltro = (id: string) => {
  // No permitir remover filtros bloqueados (como REGION cuando hay filtro forzado)
  if (filtrosInteractivos[id]?.bloqueado) {
    console.log('[PivotBuilder] No se puede remover filtro bloqueado:', id);
    return;
  }
  
  const index = filtros.value.indexOf(id);
  if (index > -1) {
    filtros.value.splice(index, 1);
    void consultarPivot();
  }
};

const limpiarTodosLosFiltros = () => {
  // Limpiar todas las selecciones de los filtros (excepto los bloqueados)
  Object.keys(filtrosInteractivos).forEach((field) => {
    if (filtrosInteractivos[field] && !filtrosInteractivos[field].bloqueado) {
      filtrosInteractivos[field].seleccionados = [];
    }
  });
  
  // Ejecutar consulta para mostrar datos sin filtros
  void consultarPivot();
};

const removerFila = (id: string) => {
  const index = filas.value.indexOf(id);
  if (index > -1) {
    filas.value.splice(index, 1);
    void consultarPivot();
  }
};

const removerColumna = (id: string) => {
  const index = columnas.value.indexOf(id);
  if (index > -1) {
    columnas.value.splice(index, 1);
    void consultarPivot();
  }
};

const removerValor = (id: string) => {
  const index = valores.value.indexOf(id);
  if (index > -1) {
    valores.value.splice(index, 1);
    void consultarPivot();
  }
};

// Opciones para el selector compacto de años
const opcionesAnios = computed(() => {
  return aniosDisponibles.value.map(anio => ({
    valor: anio,
    etiqueta: anio.toString()
  }));
});

// Manejar cambio de años desde el MultiSelect
const onAniosChange = (valores: Array<string | number>) => {
  const nuevosAnios = valores
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  if (nuevosAnios.length > 0) {
    // Ordenar años descendente (más reciente primero)
    aniosSeleccionados.value = nuevosAnios.sort((a, b) => b - a);
  } else {
    // Si el usuario deselecciona todos los años, usar el más reciente disponible
    const primerAnio = aniosDisponibles.value[0];
    const anioReciente = primerAnio !== undefined ? primerAnio : 2025;
    aniosSeleccionados.value = [anioReciente];
  }

  // Ejecutar consulta automáticamente
  void consultarPivot();
};

onMounted(async () => {
  await Promise.all([
    cargarCatalogo(),
    cargarAniosDisponibles()
  ]);
  
  // Si hay filtro de región forzado, agregar REGION a filtros automáticamente
  if (esFiltroForzado.value && regionForzada.value) {
    console.log('[PivotBuilder] Agregando filtro de región forzado:', regionForzada.value, nombreRegionForzada.value);
    
    // Agregar REGION a la lista de filtros si no está ya
    if (!filtros.value.includes('REGION')) {
      filtros.value.push('REGION');
    }
    
    // Configurar el filtro interactivo con el valor forzado y bloqueado
    filtrosInteractivos['REGION'] = {
      field: 'REGION',
      label: 'Región',
      options: [{
        valor: regionForzada.value,
        etiqueta: nombreRegionForzada.value || `Región ${regionForzada.value}`
      }],
      seleccionados: [regionForzada.value],
      bloqueado: true // Marcar como bloqueado para no permitir cambios
    };
  }
  
  await consultarPivot();
});

onBeforeUnmount(() => {
  if (progresoResetTimeout) {
    window.clearTimeout(progresoResetTimeout);
  }
  // Detener progreso continuo si está activo
  detenerProgresoContinuo();
  // Cancelar cualquier consulta pendiente al desmontar el componente
  cancelarConsultaPivot();
});
</script>
