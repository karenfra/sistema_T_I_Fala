'use client'

import { Download } from 'lucide-react'

export default function Home() {
  return (
    <>
      {/* Aplicación autocontenida embebida: ocupa todo el viewport.
          El scroll lo gestiona la app interna del iframe. */}
      <iframe
        src="/Sistema_Ventas_Sagabella.html"
        title="Sistema de Ventas Sagabella"
        aria-label="Sistema de Ventas Sagabella"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />

      {/* Pestaña vertical de descarga — borde derecho, centrada verticalmente.
          Reposicionada para no tapar el perfil del sidebar (incidencia 22582)
          ni el chatbot (abajo a la derecha). */}
      <div className="group fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 sm:block">
        <a
          href="/Sistema_Ventas_Sagabella.html"
          download="Sistema_Ventas_Sagabella.html"
          aria-label="Descargar Sistema_Ventas_Sagabella.html"
          className="flex items-center gap-2 rounded-l-xl border border-r-0 border-neutral-200 bg-white/90 py-3 pl-3 pr-3.5 text-xs font-medium text-neutral-700 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          style={{ writingMode: 'vertical-rl' }}
        >
          <Download className="h-3.5 w-3.5 rotate-[-90deg]" aria-hidden="true" />
          Descargar HTML
        </a>
        {/* Tooltip simple en hover / focus */}
        <span
          role="tooltip"
          className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          Descargar Sistema_Ventas_Sagabella.html
        </span>
      </div>
    </>
  )
}
