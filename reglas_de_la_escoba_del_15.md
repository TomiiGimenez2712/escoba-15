# Especificación y Reglas del Juego: Escoba del 15

Este documento define las reglas oficiales, la lógica de turnos, el sistema de puntuación y los casos especiales para desarrollar una versión digital del juego de cartas **Escoba del 15** con baraja española.

---

## 1. Configuración General
* **Jugadores:** 2, 3 o 4 jugadores.
  * **2 o 3 jugadores:** Modalidad individual (todos contra todos).
  * **4 jugadores:** Modalidad en parejas (2 contra 2, sentados de forma alternada; comparten la pila de cartas ganadas y los puntos).
* **Objetivo del juego:** Ser el primer jugador (o pareja) en alcanzar o superar los **15 puntos** (partida corta) o **21 puntos** (partida larga) al finalizar una ronda. Este límite se define antes de iniciar la partida.
* **Sentido de juego:** Antihorario (hacia la derecha), tanto para repartir como para los turnos.

---

## 2. El Mazo y Valor de las Cartas
Se utiliza una **baraja española de 40 cartas** (se excluyen los 8, los 9 y los comodines).
* **Palos (4):** Oros, Copas, Espadas, Bastos (10 cartas por palo).

### Tabla de Valores para sumar 15
| Carta | Índice / Número | Valor en el juego |
| :--- | :---: | :---: |
| As | 1 | **1** |
| Dos | 2 | **2** |
| Tres | 3 | **3** |
| Cuatro | 4 | **4** |
| Cinco | 5 | **5** |
| Seis | 6 | **6** |
| Siete | 7 | **7** |
| Sota | 10 | **8** |
| Caballo | 11 | **9** |
| Rey | 12 | **10** |

---

## 3. Flujo de una Ronda (Game Loop)

Cada partida se divide en **rondas**. Una ronda dura hasta que se agotan las 40 cartas del mazo.

### Fase 1: Preparación y Reparto Inicial
1. Se barajan las 40 cartas.
2. El **repartidor** (que rota al siguiente jugador en cada ronda) entrega **3 cartas a cada jugador**, una por una.
3. A continuación, el repartidor coloca **4 cartas boca arriba** en el centro de la mesa.
4. **Regla especial — "Escoba de mano":**
   * Antes de que juegue el primer jugador, el sistema debe verificar la suma de las 4 cartas iniciales de la mesa.
   * Si las 4 cartas suman exactamente **15**: El repartidor las recoge automáticamente, las suma a su pila de ganadas y anota **1 escoba**. La mesa queda vacía para el primer turno.
   * Si las 4 cartas suman exactamente **30** (dos grupos independientes que suman 15 cada uno, por ejemplo: Rey [10] + Cinco [5] y Caballo [9] + Seis [6]): El repartidor recoge las 4 cartas y anota **2 escobas**. La mesa queda vacía.

### Fase 2: Turno del Jugador
Comienza el jugador situado a la derecha del repartidor. En su turno, el jugador **debe jugar obligatoriamente 1 carta** de su mano. Tiene dos posibles acciones:

#### Opción A: Levantar (Capturar)
* Si el valor de la carta jugada, sumado al valor de **una o más cartas** de la mesa, da **exactamente 15**, el jugador captura todas las cartas involucradas en esa suma (la suya + las de la mesa) y las guarda boca abajo en su pila de cartas ganadas.
* **Múltiples combinaciones:** Si la carta jugada puede sumar 15 con distintas combinaciones de cartas en la mesa (por ejemplo, juega un 5 y en la mesa hay un Rey [10], un Seis [6] y un Cuatro [4]), el jugador **debe elegir** qué combinación levantar (5+10 o 5+6+4). *Nota: No puede levantar ambas combinaciones a la vez, solo una suma de 15 por turno.*
* **Hacer "Escoba":** Si al levantar cartas la mesa queda **completamente vacía** (0 cartas restantes), el jugador realiza una **Escoba** (vale 1 punto extra al final de la ronda).
* El sistema debe registrar en memoria quién fue el **último jugador en levantar cartas** en la ronda.

#### Opción B: Descartar (Tirar)
* Si el jugador no puede sumar 15 con ninguna combinación de la mesa (o decide estratégicamente no hacerlo), simplemente deposita la carta elegida boca arriba en la mesa, sumándose a las cartas disponibles.

### Fase 3: Repartos Sucesivos
* Cuando todos los jugadores se quedan sin cartas en la mano (tras 3 turnos cada uno), el repartidor vuelve a dar **3 cartas a cada jugador** desde el mazo restante.
* **Importante:** En estos repartos intermedios **no** se vuelven a poner cartas nuevas en la mesa.
* Este ciclo (jugar 3 cartas -> repartir 3 cartas) se repite hasta que no queden cartas en el mazo.

### Fase 4: Fin de la Ronda
* Una vez que se juega la última carta de la última mano repartida, la ronda termina.
* Si quedan cartas sueltas sobre la mesa, se las lleva automáticamente el **último jugador que haya logrado levantar cartas** durante esa ronda y las añade a su pila de ganadas.
* **Excepción:** Llevarse las cartas sobrantes al final de la ronda **NUNCA cuenta como escoba**.

---

## 4. Conteo de Puntos (Fin de Ronda)

Al finalizar cada ronda, se evalúan las pilas de cartas ganadas de cada jugador (o pareja) y se asignan los siguientes puntos:

1. **Escobas (1 punto por cada una):** Se suma 1 punto por cada escoba lograda durante la ronda.
2. **Siete de Oro / "El Velo" (1 punto):** Se otorga 1 punto al jugador/pareja que tenga el **7 de Oros** en su pila.
3. **Sietes / "La Setenta" (1 punto):** Se otorga 1 punto al jugador/pareja que haya juntado la mayor cantidad de cartas con el número **7** (hay cuatro en total).
   * *Empate:* Si hay empate en la cantidad máxima (ej. 2 contra 2, o 1-1-1-1), **nadie recibe este punto**.
4. **Oros (1 punto):** Se otorga 1 punto al jugador/pareja que tenga la mayor cantidad de cartas del palo de **Oros** (hay diez en total).
   * *Empate:* Si hay empate en la cantidad máxima (ej. 5 contra 5), **nadie recibe este punto**.
5. **Cartas / Mayoria (1 punto):** Se otorga 1 punto al jugador/pareja que haya juntado la mayor cantidad de cartas totales en su pila (sobre el total de 40 cartas).
   * *Empate:* Si hay empate en la cantidad máxima (ej. 20 contra 20), **nadie recibe este punto**.

---

## 5. Condición de Victoria
* Los puntos obtenidos en la ronda se suman al marcador acumulado de cada jugador o pareja.
* Si ningún jugador/pareja alcanzó el puntaje objetivo (15 o 21 puntos), se inicia una **nueva ronda** rotando el rol de repartidor al siguiente jugador.
* Si uno o más jugadores/parejas alcanzan o superan el puntaje objetivo al finalizar la ronda:
  * Gana quien tenga el **puntaje total más alto**.
  * **Desempate final:** Si dos o más jugadores/parejas superan el límite en la misma ronda y quedan empatados con exactamente el mismo puntaje máximo, se juegan **rondas adicionales de desempate** hasta que uno supere al otro al finalizar una ronda.

---

## 6. Notas Técnicas para la Implementación (IA / Desarrollo)
* **Validación de jugadas:** Al seleccionar una carta de la mano, el motor del juego debe calcular todos los subconjuntos de cartas en la mesa cuya suma más la carta elegida sea igual a `15`.
  * Si `subconjuntos.length === 0`: La acción obligatoria es descartar la carta a la mesa.
  * Si `subconjuntos.length === 1`: Se ejecuta la captura automáticamente (o tras confirmación).
  * Si `subconjuntos.length > 1`: La interfaz debe permitir al usuario seleccionar qué grupo de cartas de la mesa desea levantar.
* **Inteligencia Artificial (Bots):** Si se implementan oponentes controlados por la IA, su orden de prioridad al elegir entre múltiples combinaciones debería ser:
  1. Hacer **Escoba** (dejar la mesa en 0).
  2. Capturar el **7 de Oros**.
  3. Capturar cualquier otro **7**.
  4. Capturar cartas de **Oros**.
  5. Capturar la **mayor cantidad de cartas** posible.
  6. Al descartar, evitar dejar en la mesa cartas que sumen menos de 15 junto con cartas altas (idealmente tirar cartas bajas si la mesa está vacía o si la suma total en mesa supera 15 sin combinaciones fáciles para el rival).