# 🎮 Simulador de Juego FIRST Global Challenge Incheon 2026 — Team Colombia

Este es el simulador interactivo y calculadora visual de puntuación oficial de **Team Colombia** para el reto *Igniting Innovation* del **FIRST Global Challenge 2026** en Incheon, Corea del Sur.

## 🚀 Despliegue en Vercel
Este proyecto está optimizado para funcionar como una aplicación web estática pura (HTML, CSS, JavaScript vainilla) y puede ser desplegada en **Vercel** en cuestión de segundos:

1. Importá este repositorio (`fgc-2026-game-simulator`) en tu cuenta de Vercel.
2. Dejá la configuración del proyecto por defecto (no requiere comandos de compilación ni directorio de salida especial).
3. Hacé clic en **Deploy**. ¡Listo!

---

## ✨ Características Premium

* 🎮 **Campo Interactivo Tipo Videojuego:** Representación top-down fidedigna al campo oficial (Braces, Zones, Human Player, Guardrails, Suppression Units, Extinguisher y Fire Shields).
* ⚙️ **Interactividad Completa:**
  * **Drag & Drop:** Arrastrá los robots a lo largo del soporte (Brace) y la calculadora detectará automáticamente la zona (Contact, Zone 1, Zone 2, Zone 3) con feedback visual de tamaño y brillo.
  * **Doble Clic para Buddy Climb:** Enlazá visualmente los robots haciendo doble clic para simular que un robot está colgado del otro (cadena dorada animada con icono de enlace).
  * **Clic Derecho / Menú de Contexto:** Opciones rápidas de posicionamiento, reset e info del robot.
* 📊 **Calculadora Visual FGC:** Marcador estilo transmisión deportiva con desglose en tiempo real de puntos por alianza, multiplicadores y puntos globales.
* 📋 **Carga de Escenarios de Alumnos:** Selector dropdown premium con glassmorphism y categorizado por alumnos que carga automáticamente los 11 escenarios planificados por los equipos (Tania, Moncada, Jhon, Sergio).
* 🗺️ **Heatmap (Mapa de Calor):** Visualización de las zonas óptimas y estratégicas de puntuación en el campo.
* ⏱️ **Match Timer de 2:30:** Temporizador funcional con alertas visuales críticas a los 30s y 10s para simulaciones en tiempo real y prácticas de estrategia.
* 🏆 **Leaderboard Local:** Guardá y compará múltiples configuraciones y combinaciones en un ranking local en tu navegador.
* 📷 **Exportación de Configuración:** Generación instantánea de una imagen PNG que incluye el estado del campo, puntuación detallada de ambas alianzas y marca de agua compartible.
* 📱 **Soporte Táctil Integrado:** Diseñado y optimizado para pantallas táctiles de tablets y celulares en la pista de práctica.

---

## 🛠️ Estructura del Proyecto

* `index.html` — Estructura principal y maquetación visual de la calculadora.
* `estrategias.html` — Tablero de comparación y métricas de las estrategias de los estudiantes.
* `style.css` — Sistema de diseño oscuro premium, tokens de color oficiales, animaciones y glassmorphism.
* `index.js` — Motor del simulador, física de partículas, renderizado en Canvas, interactividad drag-and-drop y motor de puntuación de la fórmula oficial.

---

*Desarrollado con orgullo para la **Fundación Team Colombia de Educación e Innovación Educativa**.* 🇨🇴
