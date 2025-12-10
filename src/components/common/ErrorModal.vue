<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="cerrar"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
        <!-- Modal -->
        <div class="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
          <!-- Icono según tipo de error -->
          <div class="flex justify-center -mt-8">
            <div :class="iconoClases" class="flex h-16 w-16 items-center justify-center rounded-full shadow-lg">
              <!-- Rate Limit -->
              <svg v-if="error?.tipo === 'rate_limit'" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <!-- Timeout -->
              <svg v-else-if="error?.tipo === 'timeout'" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <!-- Servidor ocupado -->
              <svg v-else-if="error?.tipo === 'servidor_ocupado'" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <!-- Error general -->
              <svg v-else class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          
          <!-- Contenido -->
          <div class="px-6 pt-6 pb-8 text-center">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">
              {{ error?.titulo || 'Error' }}
            </h3>
            
            <p class="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {{ error?.mensaje || 'Ha ocurrido un error inesperado.' }}
            </p>
            
            <!-- Contador de reintento -->
            <div v-if="tiempoRestante > 0" class="mb-6">
              <div class="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-700 px-4 py-2">
                <svg class="h-4 w-4 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Podrás reintentar en {{ tiempoRestante }} segundos
                </span>
              </div>
            </div>
            
            <!-- Sugerencias según tipo de error -->
            <div v-if="sugerencias.length" class="mb-6 text-left">
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sugerencias:</p>
              <ul class="space-y-1">
                <li v-for="(sugerencia, idx) in sugerencias" :key="idx" class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span class="text-orange-500 mt-0.5">•</span>
                  {{ sugerencia }}
                </li>
              </ul>
            </div>
            
            <!-- Botones -->
            <div class="flex gap-3 justify-center">
              <button
                v-if="tiempoRestante <= 0"
                @click="reintentar"
                class="px-6 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Reintentar
              </button>
              <button
                @click="cerrar"
                :class="tiempoRestante > 0 
                  ? 'px-6 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'
                  : 'px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2'"
              >
                {{ tiempoRestante > 0 ? 'Entendido' : 'Cerrar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import type { PivotError } from '../../services/pivot';

const props = defineProps<{
  error: PivotError | null;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'cerrar'): void;
  (e: 'reintentar'): void;
}>();

const tiempoRestante = ref(0);
let intervalo: number | null = null;

// Clases del icono según tipo de error
const iconoClases = computed(() => {
  switch (props.error?.tipo) {
    case 'rate_limit':
      return 'bg-orange-500';
    case 'timeout':
      return 'bg-amber-500';
    case 'servidor_ocupado':
      return 'bg-blue-500';
    default:
      return 'bg-red-500';
  }
});

// Sugerencias según tipo de error
const sugerencias = computed(() => {
  switch (props.error?.tipo) {
    case 'rate_limit':
      return [
        'Espera el tiempo indicado antes de hacer otra consulta',
        'Evita cambiar los filtros muy rápidamente',
        'Revisa los datos mientras esperas'
      ];
    case 'timeout':
      return [
        'Selecciona menos años en tu consulta',
        'Agrega filtros para reducir los datos',
        'Consulta por región específica en lugar de todas'
      ];
    case 'servidor_ocupado':
      return [
        'Otros usuarios están usando el sistema',
        'Espera unos segundos e intenta de nuevo',
        'El sistema se recuperará automáticamente'
      ];
    default:
      return [];
  }
});

// Iniciar contador cuando hay tiempo de reintento
watch(() => props.error?.reintentarEn, (nuevoTiempo) => {
  if (nuevoTiempo && nuevoTiempo > 0) {
    tiempoRestante.value = nuevoTiempo;
    iniciarContador();
  }
}, { immediate: true });

watch(() => props.visible, (esVisible) => {
  if (!esVisible) {
    detenerContador();
  }
});

const iniciarContador = () => {
  detenerContador();
  intervalo = window.setInterval(() => {
    if (tiempoRestante.value > 0) {
      tiempoRestante.value--;
    } else {
      detenerContador();
    }
  }, 1000);
};

const detenerContador = () => {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
};

const cerrar = () => {
  emit('cerrar');
};

const reintentar = () => {
  emit('reintentar');
};

onUnmounted(() => {
  detenerContador();
});
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.9) translateY(20px);
}
</style>
