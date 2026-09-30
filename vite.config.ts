import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'

const responderProxyNoDisponible = (
  res: http.ServerResponse | import('node:net').Socket,
  payload: { error: string; details: string }
) => {
  if (!('writeHead' in res) || !('end' in res) || res.writableEnded) {
    return
  }

  res.writeHead(502, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/api/humana': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de Humana no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/valets': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de valets no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/descuentos': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de descuentos no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/nomina': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de nomina no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/contabilidad': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de contabilidad no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/accesorios': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de accesorios no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/proyectos': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            responderProxyNoDisponible(res, {
              error: 'Backend de proyectos no disponible',
              details: 'Inicia el backend con npm run dev:backend',
            })
          })
        },
      },
      '/api/n8n': {
        target: 'https://n8n.172.10.219.15.sslip.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/n8n/, ''),
        secure: false,
      },
      '/api/n8n-desarrollo': {
        target: 'https://sitecdesarrollo-n8n.9hwbyc.easypanel.host',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/n8n-desarrollo/, ''),
        secure: false,
      }
    }
  }
})
