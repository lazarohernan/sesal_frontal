# Frontend BI SESAL

Frontend del Sistema de Business Intelligence para SESAL (Secretaría de Salud de Honduras).

## 🚀 Tecnologías

- **Vue.js 3** con Composition API y TypeScript
- **Vite** para desarrollo y build
- **Tailwind CSS** para estilos
- **Vue Router** para navegación
- **MapLibre GL** para mapas interactivos
- **Lucide Vue** para iconos
- **jsPDF** y **xlsx** para exportación de datos

## 📋 Prerrequisitos

- Node.js 18+
- npm o yarn

## 🛠️ Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno (si es necesario):
Crear archivo `.env` con las siguientes variables:
```
VITE_API_BASE_URL=http://localhost:3000
```

## 🏃 Ejecución

### Desarrollo
```bash
npm run dev
```

### Build para producción
```bash
npm run build
```

### Build como widget
```bash
npm run build:widget
```

### Preview de producción
```bash
npm run preview
```

## 📁 Estructura del Proyecto

```
webapp-BISESAL/
├── public/                 # Archivos estáticos
│   ├── geo/               # Archivos GeoJSON para mapas
│   └── img*.jpeg          # Imágenes
├── src/
│   ├── components/        # Componentes Vue
│   │   ├── common/       # Componentes comunes
│   │   ├── config/       # Componentes de configuración
│   │   ├── dashboard/    # Componentes del dashboard
│   │   ├── layout/       # Componentes de layout
│   │   ├── reports/      # Componentes de reportes
│   │   └── ui/           # Componentes UI
│   ├── composables/      # Composables de Vue
│   ├── router/           # Configuración de rutas
│   ├── services/         # Servicios API
│   ├── types/            # Definiciones TypeScript
│   ├── utils/            # Utilidades
│   ├── views/            # Vistas principales
│   ├── App.vue           # Componente raíz
│   ├── main.ts           # Punto de entrada
│   ├── style.css         # Estilos globales
│   ├── web-component.js  # Web Component wrapper
│   └── widget.css        # Estilos del widget
├── index.html            # HTML principal
├── package.json
├── vite.config.ts        # Configuración de Vite
├── tailwind.config.ts    # Configuración de Tailwind
└── tsconfig.json         # Configuración de TypeScript
```

## 🎨 Características Principales

- **📊 Dashboard Interactivo**: Visualizaciones dinámicas de datos
- **🗺️ Mapa de Honduras**: Visualización geográfica interactiva
- **📈 Gráficos Dinámicos**: Barras e iconos con datos en tiempo real
- **🔍 Tablas Dinámicas**: Constructor de tablas pivot con drag & drop
- **📤 Exportación**: Exportación a PDF, Excel y CSV
- **🎨 Widget Embebible**: Componente web embebible para otros sitios
- **📱 Responsive**: Diseño adaptable a dispositivos móviles

## 🔌 Configuración de API

El frontend se conecta al backend a través de la variable de entorno `VITE_API_BASE_URL`. Por defecto, si no está configurada, usa `http://localhost:3000`.

## 📦 Build como Widget

El proyecto puede compilarse como un Web Component embebible:

```bash
npm run build:widget
```

Esto genera un widget que puede ser embebido en cualquier página HTML.

## 🚀 Despliegue

### Vercel
El proyecto incluye configuración para Vercel (`vercel.json`). Simplemente conecta el repositorio a Vercel.

### Otros proveedores
Después de ejecutar `npm run build`, los archivos en `dist/` pueden ser servidos por cualquier servidor web estático.

## 📄 Licencia

ISC
