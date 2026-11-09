# 喫茶店 Sandō · Café

El kissaten de Kenji: aprender a preparar café de verdad, con modelos de simulación (no números al azar).

**🎓 Academia de barismo**: 8 módulos que siguen el ciclo aprender → experimentar → equivocarse → recibir feedback → corregir → dominar.

| | |
|---|---|
| ☕ El espresso perfecto | Molé, dosificá, distribuí, tampeá y extraé en tiempo real. Carrera de 9 lecciones y desafío diario. |
| 🩺 Diagnóstico de espresso | Leé el tiempo, el peso y el sabor; nombrá la causa y elegí la corrección. |
| 🥤 ¿Qué café preparaste? | Verté espresso, leche, espuma y agua; un clasificador te dice qué bebida armaste. |
| 🧾 Prepará el pedido | Taza, shots, vaporizado y vertido en el orden correcto. |
| 🎨 Latte Art Academy | Posición, inclinación y altura de la jarra: corazón, tulipán y rosetta. |
| ⏱️ Rush Hour | La hora pico: clientes con paciencia, dos grupos y un vaporizador compartidos. |
| 🫖 Laboratorio de filtrados | V60, AeroPress y prensa, con comparación A/B de una sola variable. |
| 🌱 Laboratorio de blends | Mezclá orígenes, procesos y tuestes; perfil sensorial estimado. |

Además: laboratorio de extracción con gráfico de control, desafío de calibración, la barra de pedidos, quiz barista, guías paso a paso para tu cafetera y una bitácora de los cafés reales que preparás.

El diseño de la Academia está en [`docs/academia-barismo.md`](docs/academia-barismo.md).

## Cómo correrla

Necesitás Python 3 (solo la biblioteca estándar).

```bash
python server.py            # abre http://127.0.0.1:8774 en el navegador
python server.py --no-abrir --puerto 8774
```

En Windows, `iniciar.pyw` levanta el servidor (o lo reinicia si el código cambió) y abre la app en una ventana de Edge. Cada senda usa su propio puerto, así que podés tener varias abiertas a la vez.

### Controles

Todo se puede usar con mouse, con el teclado (flechas para moverse entre opciones, Enter para elegir, Esc o X para volver) o con un joystick (A elegir, B volver). Arriba: tu nivel y progreso (clic en el nombre), las misiones del día y las opciones.

## Pruebas

```bash
npm test      # node:test, sin dependencias
```

## Partida y respaldo

El progreso (nivel, racha, misiones del día, logros) se guarda solo en `datos/partida.json` (con una copia por día) y en el navegador. Desde **⚙ Opciones** podés exportar un respaldo y restaurarlo.

Como usa el mismo formato que [Sandō](https://github.com/Lauaf/Sando), podés exportar tu partida desde Sandō y restaurarla acá para seguir con el mismo progreso.

## IA local (opcional)

Si hay un modelo local corriendo, Kenji inventa preguntas nuevas para el quiz y comenta los cafés de tu bitácora. Primero se prueba Qwen (EXL3, puerto 8888) y después Ollama (puerto 11434).

## Relación con Sandō

Esta app es una de las sendas de [Sandō](https://github.com/Lauaf/Sando), el pueblo pixel art donde se practica japonés, piano y café, separada para usarla sola. Es una copia independiente: conserva el historial de commits de sus archivos y desde acá evoluciona por su cuenta.

## Estructura

```
server.py              servidor local: archivos, partida y puente a la IA
iniciar.pyw            lanzador para Windows
web/
  index.html, estilo.css
  js/app.js            arranque de la app
  js/perfil.js         mi progreso: nivel, misiones, últimas dos semanas y logros
  js/progreso.js       XP, niveles, racha, misiones, logros, repaso espaciado y guardado
  js/actividad.js      pantallas (pila con Esc para volver, navegación con flechas)
  js/opciones.js       opciones y respaldo
  js/dialogo.js, js/jp/texto.js, js/ia.js, js/mando.js, js/util.js   piezas compartidas
  js/cafe.js           el kissaten (laboratorio, barra, quiz, guías, bitácora)
  js/cafe/             Academia de barismo: modelos de simulación (modelo-*.js) y vistas
  js/datos/cafe.js     métodos, bebidas y orígenes
tests/                 pruebas de los modelos de la Academia
docs/                  diseño de la Academia
```

No hay paso de build ni dependencias de npm: la app son módulos ES servidos tal cual.
