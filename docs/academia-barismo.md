# 🎓 Academia de barismo — kissaten de Kenji

La senda del café de Sandō pasó de tener un laboratorio, una barra y un quiz a tener una **academia interactiva** con 8 módulos prácticos. Cada módulo sigue el ciclo **aprender → experimentar → equivocarse → recibir feedback → corregir → dominar**, y todos se apoyan en modelos de simulación (no en números al azar).

Se entra desde el pueblo: puerta del 喫茶店 → sección **🎓 Academia de barismo**, arriba de las herramientas que ya existían (que siguen igual, más abajo, en **☕ El kissaten**).

---

## 1. Auditoría

### 1.1 El proyecto

| Aspecto | Hallazgo |
|---|---|
| Stack | HTML + CSS + JavaScript vanilla con módulos ES, **sin build ni dependencias**. Servidor `server.py` (solo stdlib) que sirve `web/`, guarda la partida y hace de puente a una IA local opcional. |
| Estética | Juego estilo GBA: pueblo en canvas pixel-art, fuente DotGothic16, paleta oscura con acentos (café `#d39a62`). |
| Navegación | Pueblo → puertas de edificios → `actividad.js` (ventana con pila de pantallas, Esc/X vuelve). Cada senda tiene un hub de tarjetas (`.rejilla` / `.tarjeta`). |
| Progreso | `progreso.js`: XP por habilidad, niveles, racha, misiones diarias, logros, repaso espaciado. Se guarda en `datos/partida.json` (servidor) y `localStorage`. |
| Café antes de la academia | Laboratorio (modelo de extracción por método + gráfico de control), desafío de calibración, barra de pedidos (botones + / −), quiz, guía en vivo con voz, bitácora real, equipo. |
| Tests | No había. |
| Móvil | La ventana de actividades quedaba del tamaño de la pantalla "GBA" escalada (~360 × 240 px en un teléfono). |

**Dónde encajan los minijuegos:** como una sección propia dentro del hub del kissaten, reutilizando `actividad.js` (navegación y Esc), `progreso.js` (XP, logros, misiones, guardado) y las clases de estilo existentes.

### 1.2 Plataformas de referencia

La red de este entorno bloquea los dominios de las referencias (`CONNECT 403`), así que no pude abrirlas ni jugarlas. Usé búsqueda web (índices de buscadores) y, en el caso de SIMBUCKS, el código fuente público. **Lo que no pude verificar está marcado como "no verificado"**: ahí la columna "Mecánica" describe lo que vos pediste estudiar, no algo que yo haya comprobado.

| Plataforma | Verificación | Mecánica | Qué enseña | Interactividad | Valor para Sandō | Complejidad | Prioridad |
|---|---|---|---|---|---|---|---|
| **Dial It In** (dialyourshot.com) | Parcial (texto indexado del sitio) | Desafío diario con receta rota: 1 shot de diagnóstico gratis + 5 intentos; carrera de lecciones que se desbloquean con un puntaje mínimo; puntaje 0–100, 0–3 estrellas, etiquetas de defecto y pistas. | Calibrar espresso, diagnosticar defectos, canalización. | Alta | Muy alto: es el corazón de la extracción | Media | **1** |
| **SIMBUCKS** | Sí (repo, licencia Apache-2.0; solo leí conceptos) | Cafetería 3D en primera persona; turno en 3 actos con dificultad creciente; estaciones con "medidores" de mantener (shot con punto dulce 22–30 s, leche 60–68 °C y quemada a 75 °C); clientes con paciencia; fallas por pedido; tarjeta de fin de turno; tests headless sin dependencias. | Flujo de trabajo, tiempos, priorización. | Muy alta | Alto (modelo para Rush Hour y para los tests) | Alta en 3D, media en 2D | **2** |
| **RasoKarsa Coffee Lab** | Parcial (la home menciona Coffee Lab con modos Brew, AI Barista, Blend y Rush Hour ligados a una "academia") | Pedidos según preferencias, mezcla de granos, contrarreloj, XP/niveles/rachas (detalle no verificado). | Recetas, servicio, blends. | — | Alto como estructura de "academia + laboratorio" | Media | 2 |
| **Coffee Coaching Club** (`.pro`) | No verificado (`.pro` inaccesible; la tienda `.ch` habla de WDT, canalización, agua) | Simuladores de extracción, presión, puck, leche, latte art, agua, molinos, tueste, filtrados, sensorial. | Muy amplio. | — | Alto como catálogo de temas | Alta | 3 |
| **GramCups Café** | No verificado | Verter ingredientes con precisión en gramos, cola de clientes con paciencia, taza que se llena. | Precisión, proporciones. | — | Medio-alto (taza dinámica, vertido) | Baja | 2 |
| **CoffeeTweaks — Milk Map** | No verificado (la home menciona calculadora de ratio y visualizador de molienda) | Armar bebidas por proporciones y compararlas con recetas. | Diferencias entre latte, cappuccino, cortado, etc. | — | Alto (clasificador de bebidas) | Baja | **1** |
| **Latte Flow** (latteart.com.br) | No verificado | Vertido con inclinación, movimiento y velocidad; vaporización; progresión corazón → tulipán → rosetta. | Latte art y texturizado. | — | Muy alto | Alta | **1** |
| **CoffeeScope** | No verificado (sí encontré simuladores V60 open source basados en física) | V60 y otros métodos, comparación de dos extracciones, flujo, molienda y temperatura. | Filtrados, experimentar con una variable. | — | Alto (A/B) | Media | 2 |

No copié código, diseños, ilustraciones ni recursos de ninguna plataforma: todo lo dibujado es SVG/canvas generado por código y los modelos son propios.

---

## 2. Diseño

### 2.1 Ruta y navegación

```
Pueblo → 喫茶店 → 🎓 Academia de barismo
   ├─ recomendaciones ("Qué practicar después")   ← errores repetidos y competencias flojas
   ├─ 📊 Mi progreso (dominio por competencia)
   ├─ 1 ☕ El espresso perfecto        (Extracción)
   ├─ 2 🩺 Diagnóstico de espresso      (Diagnóstico)
   ├─ 3 🥤 ¿Qué café preparaste?        (Recetas)
   ├─ 4 🧾 Prepará el pedido            (Leche)
   ├─ 5 🎨 Latte Art Academy            (Latte art)
   ├─ 6 ⏱️ Rush Hour                    (Servicio)
   ├─ 7 🫖 Laboratorio de filtrados     (Filtrados)
   └─ 8 🌱 Laboratorio de blends        (Cata)
```

El orden prioriza valor educativo y reutilización técnica: el modelo de espresso alimenta el diagnóstico, los pedidos y Rush Hour; el modelo de bebidas y el de leche alimentan la taza, los pedidos y Rush Hour.

### 2.2 Progresión y gamificación

- **Lecciones en orden:** cada módulo tiene lecciones que se desbloquean al **aprobar** la anterior (umbral propio de cada juego). Siempre hay un modo libre sin límite.
- **Dominio por competencia** (8 competencias): promedio de los últimos 8 resultados. Sube si mejorás, no por jugar más.
- **XP** con el sistema existente: proporcional al puntaje; bonus solo al aprobar por primera vez o mejorar. La práctica libre da la mitad.
- **Recomendaciones:** errores que se repiten (p. ej. canalización ×2) → la lección que lo enseña; después, la competencia más floja; después, lo que no probaste.
- **Logros por habilidades reales** (no por tiempo): espresso balanceado sin canalizar, carrera de espresso completa, 10 diagnósticos correctos, primer corazón, rosetta, turno sin perder clientes, 5 experimentos A/B de una sola variable, blend aprobado.
- **Misiones diarias:** se sumaron dos al pozo de café (actividades de la academia, diagnósticos). No se agregaron mecánicas de retención nuevas (sin vidas, sin cajas, sin penalizar ausencias).
- **Desafío diario de espresso:** receta rota igual para todos ese día; 1 diagnóstico + 5 intentos. Si ya lo jugaste, la práctica libre sigue disponible.

---

## 3. Módulos

### 3.1 ☕ El espresso perfecto
- **Acciones:** girar la perilla del molino (arrastrar / flechas), **moler manteniendo apretado** mientras la balanza sube, quitar o vaciar, **WDT dibujando círculos** sobre la canasta (los grumos desaparecen), **tampear** con un nivel de burbuja que oscila (el nivelado depende de cuándo apretás), temperatura (PID), perfil de presión (plano, preinfusión, declinante), **Extraer / Cortar** (botón o Espacio), velocidad ×1/×2.
- **Visual en tiempo real:** manómetro, reloj, chorro cuyo grosor sigue al caudal y cuyo color sigue a la concentración (se "rubia" al final), gotas y salpicaduras si canaliza, taza que se llena con crema, balanza, gráfico en vivo de presión/caudal/peso y mapa de extracción con todos tus shots.
- **Feedback:** puntaje 0–100 y estrellas, perfil de sabor estimado, defectos con explicación y consejo, y **comparación con el shot anterior** (qué cambiaste y qué efecto tuvo; avisa si cambiaste más de una cosa).
- **Carrera (9 lecciones):** cortar a tiempo → shot que vuela → shot que no sale → ristretto → canalización → cambio de dosis → tueste claro → tueste oscuro → preinfusión. Cada lección habilita solo los controles que enseña. Se aprueba con 75.

### 3.2 🩺 Diagnóstico de espresso
- Casos generados con **el mismo modelo** del simulador: queja del cliente, receta, tiempo, primera gota, notas de cata, pistas visuales, curva de presión/caudal y color de la crema.
- Paso 1: causa más probable (subextracción, sobreextracción, canalización, ratio largo/corto). Paso 2: corrección (4 opciones). Después ves **qué habría pasado con cada opción** (tiempo, extracción y puntaje simulados) y podés **probarlo en el simulador** con la receta del caso.
- Varias correcciones pueden ser válidas: se clasifican como "la mejor", "también sirve", "ayuda poco", "casi no cambia", "empeora". 3 rondas (básica, intermedia, avanzada).

### 3.3 🥤 ¿Qué café preparaste?
- **Arrastrá las jarras** (espresso, leche vaporizada, espuma, agua) sobre la taza para verter; mientras está encima, vierte. Con teclado: mantener Espacio sobre la jarra.
- La taza (SVG) se llena por capas: la espuma flota, el espresso al final sobre leche queda en capas (latte macchiato) y sobre agua conserva la crema (long black).
- **Clasificador en vivo** por proporciones y orden; **comparación con recetas** (barras de proporción, tabla en ml, consejos "agregá ~40 ml de leche", variantes regionales).
- 3 lecciones de 4 bebidas: las bases, la familia de la espuma, parecidas pero distintas.

### 3.4 🧾 Prepará el pedido
- Estaciones: **taza**, **espresso** (sacar y cortar cada shot), **leche** (llenar la jarra manteniendo, vaporizar manteniendo y elegir la posición de la punta: hundida / superficie / muy afuera, con W/S o ↑/↓; termómetro con zonas; espuma y burbujas visibles; remolino), **servir leche** arrastrando la jarra (con opción de retener la espuma o cucharada), **agua**.
- Evaluación: **exactitud** (proporciones), **técnica** (shots + temperatura/textura de leche según la bebida y el pedido: tibio, normal, bien caliente), **orden** y **presentación** (recipiente, rebalse). Servir otra bebida no se salva con buena técnica.
- 5 lecciones (sin leche, leche sedosa, mucha espuma, el orden importa, pedidos con detalles) + barra libre.

### 3.5 🎨 Latte Art Academy
- **Dibujás con el vertido:** el pico sigue al puntero (con inercia de la mano), mantener = verter, rueda o +/− = inclinación (flujo), 1/2/3 o Shift = altura (alta, media, cerca). Funciona con mouse, táctil y teclado (flechas + Espacio).
- Taza vista desde arriba con la superficie simulada en tiempo real; guía opcional de la figura; medidores de llenado, flujo y altura; **repetición** del vertido.
- Progresión: control del flujo → círculo → corazón → tulipán → rosetta. Evalúa forma (silueta + rasgos de cada figura: muesca y punta del corazón, capas del tulipán, hojas de la rosetta), simetría, centrado, definición, llenado y continuidad. Se aprueba con 80.

### 3.6 ⏱️ Rush Hour
- Turno con **actos de dificultad creciente** (apertura, media mañana, hora pico), clientes con **barra de paciencia**, **2 grupos de espresso y 1 lanceta compartidos** (hay que esperar si están ocupados), hasta 3 bebidas en paralelo.
- Consecuencias reales: el shot que no cortás se pasa, la leche que dejás se quema, **el espresso que espera se muere**, el cliente que espera demasiado se va, y la satisfacción combina calidad y espera. Caja con propinas.
- Resumen: puntaje, atendidos, perdidos, satisfacción, errores más frecuentes y qué practicar. 3 turnos (apertura, completo, hora pico). Atajos 1/2/3.

### 3.7 🫖 Laboratorio de filtrados
- V60, AeroPress y prensa francesa. Variables: café, agua, molienda (µm), temperatura, bloom (agua y espera), cantidad y velocidad de vertidos, patrón (centro/espiral), infusión y prensado.
- **Animación de la preparación** (pava, cono o cámara, nivel del agua, cama, goteo, servidor), resultados con tiempo, bebida, extracción y TDS, y **gráfico de control** con la zona dulce del método.
- **Laboratorio A/B:** dos recetas lado a lado, "copiar A", aviso en vivo de cuántas variables cambiaste, comparación en tabla, gráfico y curvas, y una conclusión cuando cambiaste una sola.
- 5 lecciones: molienda y tiempo, bloom, ratio e intensidad, AeroPress, prensa.

### 3.8 🌱 Laboratorio de blends
- 10 cafés con origen, variedad, proceso y una nota típica. **Arrastrá las bolsas a la tolva**, ajustá proporciones y tueste de cada componente.
- **Radar sensorial estimado**, cafeína relativa, crema, complejidad, barras por atributo y **"¿por qué?"** (qué aporta cada café a la mezcla). Avisos de enmascaramiento, demasiados componentes o tuestes muy distintos.
- 4 pedidos del tostador (espresso para leche, filtro frutal, espresso con robusta, equilibrio de la casa).
- Todo está rotulado como **predicción educativa**, nunca como medición.

---

## 4. Modelos y simplificaciones

Todos los números son **estimaciones de modelos didácticos**: están calibrados para que las **tendencias** sean correctas (más fino → más lento y más extracción, etc.), no para predecir una máquina o un café real. La interfaz lo dice cada vez que muestra extracción o TDS.

| Modelo | Archivo | Qué representa | Simplificaciones principales |
|---|---|---|---|
| Espresso | `modelo-espresso.js` | Paso a paso en el tiempo: presión del perfil limitada por el caudal máximo de la bomba, saturación del puck antes de la primera gota, caudal = presión / resistencia (Darcy), erosión del puck, disolución de primer orden según superficie, temperatura, tueste y caudal; canalización por preparación del puck. Calibrado: 18 g → 36 g en ~26 s ≈ 20 % EY. | Puck homogéneo de una sola resistencia; canalización determinista (riesgo → severidad) para que las consecuencias sean coherentes; sin temperatura variable durante el shot. |
| Diagnóstico | `modelo-diagnostico.js` | Escenarios = parámetros rotos; cada corrección se evalúa simulando. | Las quejas y pistas visuales salen de reglas sobre el resultado simulado. |
| Bebidas | `modelo-bebidas.js` | Recetas con **rangos** (no una receta universal) y notas de variantes; clasificador por distancia a los rangos más regla de orden; capas para dibujar. | Volúmenes en ml; la espuma se trata como volumen; las mezclas de color son aproximadas. |
| Leche | `modelo-leche.js` | Temperatura según volumen; aire con la punta en la superficie (mejor con leche fría); el remolino integra burbujas medianas; las grandes casi no se arreglan; quemada > 76 °C. | Sin tipos de leche; tiempos acelerados en Rush Hour. |
| Pedidos | `modelo-pedido.js` | Exactitud + técnica + orden + presentación; servir desde la jarra (microespuma mezclada, espuma separada si está mal texturizada). | Una sola taza "correcta" por receta en Rush Hour. |
| Latte art | `modelo-latte.js` | Grilla 80 × 80: espesor de espuma que se esparce desde donde es más gruesa, crema que se aclara con vertido alto, empuje del chorro en anillo y hacia adelante, arrastre de la jarra (relajado hacia su velocidad), capas por cada pulso de espuma con línea de crema entre capas. Advección semi-lagrangiana. | No es dinámica de fluidos real (no resuelve presión ni profundidad); los parámetros se ajustaron con vertidos "de experto" sintéticos hasta que círculo, corazón, tulipán y rosetta salieran con la técnica correcta y no con la incorrecta. La rosetta reproduce las hojas apiladas y el contorno, pero no todas las líneas internas finas de una real. |
| Rush Hour | `modelo-rush.js` | Máquina de estados del turno con semilla (reproducible), actos, paciencia, recursos compartidos, degradación del espresso y la leche. | Una sola leche, sin tamaños; shots y vapor acelerados ×3. |
| Filtrados | `modelo-filtro.js` | Dos reservas de solubles (rápida y lenta por difusión ∝ 1/d^1.5), gradiente de concentración (percolación vs inmersión), drenaje por permeabilidad ∝ d² que se tapa con finos, pérdida de temperatura, bloom/CO₂, retención en la cama (la EY se mide sobre lo que llega a la taza, como con un refractómetro). | Sin distribución real de partículas ni geometría del cono; constantes calibradas para que V60 15 g/250 g a 650 µm ≈ 19 % en ~3:10. |
| Blends | `modelo-blend.js` | Perfiles **típicos** por origen/proceso, corrimiento por tueste, promedio ponderado, enmascaramiento de lo delicado, claridad y complejidad. | Generalizaciones de manual; un lote real puede ser muy distinto. |
| Academia | `modelo-academia.js` | Dominio, desbloqueos, XP, recomendaciones. | — |

---

## 5. Arquitectura

```
web/js/cafe.js                    hub del kissaten (agrega la sección de la academia; lo demás no cambia)
web/js/cafe/
  academia.js                     ruta de módulos, sección del hub y "Mi progreso"
  progreso-academia.js            puente con progreso.js (XP, eventos, guardado en P.cafe.academia)
  mapa-errores.js                 error repetido → qué practicar
  vista.js                        piezas de UI: lienzos, bucle, intro, barras, taza SVG, arrastrar para verter, sonidos
  modelo-*.js                     lógica pura (sin DOM): se importa desde el navegador y desde Node
  espresso.js diagnostico.js taza.js pedido.js latte.js rush.js filtro.js blend.js   interfaces
tests/cafe/*.test.js              pruebas de la lógica (node:test, sin dependencias)
package.json                      solo para `npm test` (no hay dependencias)
```

- **Separación:** simulación y evaluación en `modelo-*.js`; interfaz en los demás; progreso en `progreso-academia.js`.
- **Guardado:** todo vive en `P.cafe.academia` dentro de la partida existente (servidor + `localStorage`). Las partidas viejas se completan solas (`normalizar`).
- **Sin dependencias nuevas** en el navegador.
- **Accesibilidad:** canvases con `role="img"` y descripción, zonas `aria-live` para el feedback, controles con teclado (perilla como `slider`, mantener con Espacio/Enter, atajos), `prefers-reduced-motion` reduce animaciones decorativas (las simulaciones siguen funcionando), sonidos discretos que respetan el botón de silencio.
- **Móvil:** en pantallas angostas la ventana de actividades pasa a pantalla completa (antes quedaba del tamaño de la pantalla "GBA"), con el layout de una columna y un orden pensado para tocar.

### Correr las pruebas

```
npm test        # o: node --test "tests/**/*.test.js"
```

47 pruebas: tendencias físicas del espresso, lecciones que arrancan rotas y tienen solución, correcciones coherentes en el diagnóstico, clasificación de cada receta, vaporizado, pedidos, latte art (la técnica correcta aprueba y la incorrecta no), Rush Hour (quieto = 0, bien vs. descuidado, determinismo, recursos), filtrados (molienda, bloom, ratio, inmersión) y blends.

---

## 6. Validación hecha

- `npm test`: 47/47.
- Navegador (Chromium headless con Playwright) a **1280 × 880** y **390 × 844** (táctil): se abrieron todas las lecciones y modos de los 8 módulos, "Mi progreso", las 7 herramientas previas del kissaten y el progreso/logros de la casa, **sin errores de consola**.
- Partidas jugadas de punta a punta con el puntero real: shot completo (lección 1 aprobada), práctica libre moliendo/WDT/tampeo (un tampeo torcido produce canalización y el consejo correcto), ronda de diagnóstico, vertidos arrastrando jarras (cappuccino reconocido al 100 %), pedido con vaporizado, corazón de latte art (con la misma secuencia automática de puntero: 84 en una corrida y 78 en otra, por diferencias de timing; se aprueba con 80), turno de Rush Hour, lección y A/B de filtrados, blend aprobado.

## 7. Limitaciones y próximos pasos

- **Referencias:** la mayoría no se pudieron abrir desde este entorno; si querés, puedo revisar capturas o descripciones tuyas y ajustar mecánicas.
- **Latte art:** modelo inspirado en la física, no una simulación de fluidos real. La rosetta es la figura más difícil y la más aproximada. Mejoras posibles: más resolución, profundidad de vertido, calidad de la leche que venga del módulo de pedidos.
- **Rush Hour:** 2D y con un solo tamaño de taza por bebida; se podría sumar toma de pedidos con errores de escucha, leches vegetales, molinos con dosis.
- **Filtrados:** sin Chemex/Kalita (el modelo los admite agregando geometría), sin química del agua (otro módulo posible).
- **Blends y sensorial:** perfiles genéricos; un módulo de reconocimiento sensorial con la bitácora real sería un buen complemento.
- **Sonido:** síntesis simple (bomba, vapor, vertido); se puede refinar.
