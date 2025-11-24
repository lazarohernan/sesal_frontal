import { createApp, reactive } from 'vue'
import App from './App.vue'
// Inyectar estilos dentro del Shadow DOM para aislar el widget
// Vite procesa ?inline y retorna el CSS como string ya empacado
import baseCss from './style.css?inline'
import widgetCss from './widget.css?inline'
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline'

class BISesalWidget extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._resizeObserver = null
    this._autoResize = false
  }

  static get observedAttributes() {
    return ['anio', 'departamento', 'theme', 'height', 'width', 'api-url']
  }

  connectedCallback() {
    // Config inicial desde atributos HTML
    const rawHeightAttr = this.getAttribute('height')
    const hasHeightAttr = typeof rawHeightAttr === 'string' && rawHeightAttr.trim().length > 0
    const normalizedHeight = hasHeightAttr ? rawHeightAttr.trim() : ''
    const autoHeight =
      !hasHeightAttr || normalizedHeight.toLowerCase() === 'auto'
    const initialHeight = autoHeight ? 'auto' : normalizedHeight

    const initial = {
      anio: Number.parseInt(this.getAttribute('anio') || '2024', 10),
      departamento: this.getAttribute('departamento') || '',
      theme: this.getAttribute('theme') || 'light',
      height: initialHeight,
      width: this.getAttribute('width') || '100%',
      apiUrl: this.getAttribute('api-url') || ''
    }

    this._autoResize = autoHeight

    // Crear contenedor y estilos dentro del Shadow DOM
    const hostStyle = document.createElement('style')
    hostStyle.textContent = `
      :host {
        display: block;
        width: ${initial.width};
        height: ${initial.height};
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        overflow: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
    `
    const cssStyle = document.createElement('style')
    cssStyle.textContent = `${baseCss}\n${widgetCss}\n${maplibreCss}`

    const mountPoint = document.createElement('div')
    this.shadowRoot.appendChild(hostStyle)
    this.shadowRoot.appendChild(cssStyle)
    this.shadowRoot.appendChild(mountPoint)

    // Crear la aplicación Vue y proveer un objeto reactivo para permitir updates
    const app = createApp(App)
    this._config = reactive({
      anio: initial.anio,
      departamento: initial.departamento,
      theme: initial.theme,
      isEmbedded: true,
      height: initial.height,
      width: initial.width,
      apiUrl: initial.apiUrl
    })
    app.provide('widgetConfig', this._config)

    // Montar la aplicación en el contenedor del shadow DOM
    app.mount(mountPoint)
    this._app = app
    this._mountPoint = mountPoint

    if (this._autoResize) {
      this._setupAutoResize()
    }
  }

  // Método para actualizar configuración dinámicamente
  updateConfig(config) {
    if (!this._config) return
    const entries = Object.entries(config || {})
    for (const [k, v] of entries) {
      if (k === 'height') {
        this._applyHeightValue(v)
        continue
      }
      if (k in this._config) {
        // eslint-disable-next-line no-param-reassign
        this._config[k] = k === 'anio' ? Number(v) : v
      }
    }
    // Reflejar tamaño en el host si cambia
    if (config.width) this.style.width = String(config.width)

    this.dispatchEvent(
      new CustomEvent('config-changed', { detail: { ...this._config }, bubbles: true })
    )
  }

  disconnectedCallback() {
    try {
      if (this._app) {
        this._app.unmount()
      }
      if (this._mountPoint && this._mountPoint.parentNode) {
        this._mountPoint.parentNode.removeChild(this._mountPoint)
      }
    } catch (e) {
      // swallow
    } finally {
      this._app = null
      this._mountPoint = null
      this._config = null
      this._cancelAutoResize()
    }
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (!this._config) return
    switch (name) {
      case 'anio':
        this._config.anio = Number.parseInt(newVal || '2024', 10)
        break
      case 'departamento':
        this._config.departamento = newVal || ''
        break
      case 'theme':
        this._config.theme = newVal || 'light'
        break
      case 'height':
        this._applyHeightValue(newVal)
        break
      case 'width':
        this._config.width = newVal || '100%'
        this.style.width = this._config.width
        break
      case 'api-url':
        this._config.apiUrl = newVal || ''
        break
      default:
        break
    }
  }

  _applyHeightValue(value) {
    const rawValue = typeof value === 'string' ? value.trim() : String(value ?? '')
    const auto = !rawValue || rawValue.toLowerCase() === 'auto'
    this._autoResize = auto
    if (auto) {
      this._cancelAutoResize()
      this.style.height = 'auto'
      if (this._config) {
        this._config.height = 'auto'
      }
      this._setupAutoResize()
      return
    }
    this._cancelAutoResize()
    this.style.height = rawValue
    if (this._config) {
      this._config.height = rawValue
    }
  }

  _setupAutoResize() {
    if (!this._autoResize || !this._mountPoint) return
    if (typeof ResizeObserver === 'undefined') return
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
    }
    this._resizeObserver = new ResizeObserver(() => this._applyAutoHeight())
    this._resizeObserver.observe(this._mountPoint)
    this._applyAutoHeight()
  }

  _cancelAutoResize() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
  }

  _applyAutoHeight() {
    if (!this._autoResize || !this._mountPoint) return
    const height = Math.max(
      Math.ceil(this._mountPoint.scrollHeight),
      Math.ceil(this._mountPoint.offsetHeight)
    )
    this.style.height = `${height}px`
  }
}

// Registrar el Web Component
customElements.define('bi-sesal-completo', BISesalWidget)

export default BISesalWidget
