'use client'

import { Download } from 'lucide-react'

export default function Home() {
  return (
    <>
      {/* Aplicación autocontenida embebida: ocupa todo el viewport.
          El scroll lo gestiona la app interna del iframe. */}
      <iframe
        src="/Sistema_Ventas_Falabella.html"
        title="Sistema de Ventas Falabella"
        aria-label="Sistema de Ventas Falabella"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />

      {/* Píldora flotante de descarga — esquina inferior izquierda */}
      <div className="group fixed bottom-4 left-4 z-50 hidden sm:block">
        <a
          href="/Sistema_Ventas_Falabella.html"
          download="Sistema_Ventas_Falabella.html"
          aria-label="Descargar Sistema_Ventas_Falabella.html"
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Descargar HTML
        </a>
        {/* Tooltip simple en hover / focus */}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 mb-2 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          Descargar Sistema_Ventas_Falabella.html
        </span>
      </div>
    </>
  )
}
