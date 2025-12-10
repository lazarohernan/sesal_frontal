# BI SESAL Frontend - Guía de Despliegue

## Sistema de Business Intelligence para la Secretaría de Salud de Honduras

---

## Requisitos del Servidor

### Hardware Mínimo
- **CPU:** 1 núcleo
- **RAM:** 2GB
- **Almacenamiento:** 10GB SSD

### Software
- **SO:** Ubuntu 22.04/24.04 LTS
- **Node.js:** 20.x o superior (solo para compilación)
- **Nginx:** Latest

---

## Instalación del Frontend

### 1. Clonar el Repositorio
```bash
cd /var/www
git clone https://github.com/lazarohernan/sesal_frontal.git
cd sesal_frontal
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Cree el archivo de configuración de producción:
```bash
nano .env.production
```

Agregue la URL del servidor de API:
```env
VITE_API_URL=https://api.salud.gob.hn
```

### 4. Compilar para Producción
```bash
npm run build
```

Este proceso genera la carpeta `dist` con los archivos optimizados para producción.

---

## Configuración de Nginx

Cree el archivo de configuración del sitio:
```bash
sudo nano /etc/nginx/sites-available/bisesal-dashboard
```

Agregue la siguiente configuración:
```nginx
server {
    listen 80;
    server_name bi.salud.gob.hn;

    root /var/www/sesal_frontal/dist;
    index index.html;

    access_log /var/log/nginx/bisesal-dashboard-access.log;
    error_log /var/log/nginx/bisesal-dashboard-error.log;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para archivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Compresión gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

Active la configuración:
```bash
sudo ln -s /etc/nginx/sites-available/bisesal-dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## Certificado SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bi.salud.gob.hn
```

Seleccione la opción 2 para redirigir todo el tráfico HTTP a HTTPS.

---

## Verificación

### Verificar Nginx
```bash
sudo systemctl status nginx
```

### Verificar el Dashboard
Abra en un navegador: `https://bi.salud.gob.hn`

### Verificar API
```bash
curl https://api.salud.gob.hn/salud
```

---

## Características del Frontend

### Optimización de Rendimiento
- **Build optimizado** con Vite
- **Cache de archivos estáticos** por 1 año
- **Compresión gzip** activa
- **Lazy loading** de componentes
- **Tree shaking** para reducir bundle size

### Mejoras de UX Implementadas
- **Modal de errores amigable** para usuarios no técnicos
- **Selector de años con tooltip** de tiempo estimado
- **Indicador de carga naranja** durante consultas
- **Prevención de selecciones concurrentes** durante carga
- **Soporte completo** para consultas multi-año sin límites

### Funcionalidades Especiales
- **Filtro por región automático** desde URL `?reg=X`
- **Embedding responsivo** para iframes
- **Soporte para 20 regiones** de salud
- **Visualización de datos** en tiempo real

---

## Integración y Embedding

El sistema puede ser integrado en sitios web externos:

### Ejemplo de iframe completo
```html
<iframe 
  src="https://bi.salud.gob.hn/?reg=10" 
  width="100%" 
  height="900px" 
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="BI SESAL - Intibucá"
  loading="lazy"
></iframe>
```

### URLs por región
```
https://bi.salud.gob.hn/?reg=1   → Atlántida
https://bi.salud.gob.hn/?reg=5   → Cortés
https://bi.salud.gob.hn/?reg=8   → Francisco Morazán
https://bi.salud.gob.hn/?reg=10  → Intibucá
https://bi.salud.gob.hn/?reg=19  → Distrito Central
https://bi.salud.gob.hn/?reg=20  → San Pedro Sula
```

---

## Comandos de Administración

### Actualizar el Frontend
```bash
cd /var/www/sesal_frontal
git pull origin main
npm install
npm run build
```

### Verificar Nginx
```bash
sudo systemctl restart nginx   # Reiniciar
sudo nginx -t                  # Verificar configuración
sudo tail -f /var/log/nginx/bisesal-dashboard-error.log  # Ver logs
```

### Limpiar Cache de Navegador
Para forzar actualización en todos los usuarios:
```bash
# Cambiar versión en package.json y volver a compilar
npm version patch
npm run build
```

---

## Monitoreo

### Logs Importantes
- **Nginx:** `/var/log/nginx/bisesal-dashboard-*.log`
- **Accesos:** Registro de todas las peticiones
- **Errores:** Problemas de servidor o archivos no encontrados

### Métricas de Rendimiento
- Use las herramientas de desarrollador del navegador (F12)
- Monitoree el Network tab para tiempos de carga
- Verifique Console para errores de JavaScript

---

## Solución de Problemas

### El dashboard no carga
1. Verifique que Nginx esté funcionando: `sudo systemctl status nginx`
2. Revise los logs de error de Nginx
3. Confirme que la carpeta `dist` existe y tiene archivos
4. Verifique la conectividad al API

### Los datos no se muestran
1. Abra herramientas de desarrollador (F12)
2. Revise la pestaña Network para errores de API
3. Verifique que `VITE_API_URL` sea correcta en `.env.production`
4. Confirme que el backend esté accesible

### El iframe no funciona en otro sitio
1. Verifique que use HTTPS tanto en el sitio que embebe como en BI SESAL
2. Revise la consola del navegador para errores de CORS
3. Confirme que la URL del iframe sea correcta

---

## Soporte Técnico

Para problemas técnicos:
1. Revise los logs de Nginx y las herramientas de desarrollador
2. Verifique la configuración de API en `.env.production`
3. Confirme la conectividad entre frontend y backend
4. Valide que los certificados SSL estén vigentes

---

**Versión:** 1.0.0  
**Actualizado:** Diciembre 2025  
**Instituciones:** Secretaría de Salud (SESAL) y UNFPA Honduras
