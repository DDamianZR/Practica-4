# Registro de corrimiento bidireccional de 8 bits

Simulador web de la práctica: 8 flip-flops D + 8 multiplexores 2:1, con la misma lógica y mensajes de monitor serie que `registro_bidireccional_8bits.ino`.

En línea: https://ddamianzr.github.io/Practica-4/

**Uso:** elige la dirección con DIR (0 = izquierda, entra SL en Q0; 1 = derecha, entra SR en Q7) y da flancos con CLK. Incluye vista de protoboard, circuito lógico vivo, carta de tiempos, carga paralela (`P10110011`), reloj automático y la demo de relojes desfasados (P9).

**Atajos:** Espacio = CLK · C = CLR (mientras se mantiene) · D / L / R / A = alternar DIR / SL / SR / AUTO.

**Local:** `python -m http.server` en la raíz del repositorio y abrir http://localhost:8000 (los módulos ES no cargan desde `file://`).

**Test:** `node test/registro.test.js`
