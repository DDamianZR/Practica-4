/*
  Registro de corrimiento bidireccional de 8 bits
  Implementación en Arduino UNO: 8 flip-flops D + 8 multiplexores 2:1 emulados

  Convención (LEDs colocados de izquierda a derecha: Q7 Q6 Q5 Q4 Q3 Q2 Q1 Q0)
    DIR = 0 -> corrimiento a la IZQUIERDA: Q0 -> Q1 -> ... -> Q7, entra SL en Q0, sale Q7
    DIR = 1 -> corrimiento a la DERECHA:   Q7 -> Q6 -> ... -> Q0, entra SR en Q7, sale Q0

  Ecuación de entrada de cada flip-flop (salida del mux i, selector = DIR):
    D_i = DIR'·Q(i-1) + DIR·Q(i+1)        con Q(-1) = SL  y  Q(8) = SR

  Entradas con INPUT_PULLUP (un extremo al pin, el otro a GND):
    switch cerrado / botón presionado = LOW = 1 lógico

  Monitor serie (9600 baud):
    P10110011  -> carga paralela (bits en orden Q7..Q0), se aplica en el siguiente flanco
    ?          -> imprime el estado actual
*/

// ---------------- Pines ----------------
const uint8_t PIN_Q[8] = {2, 3, 4, 5, 6, 7, 8, 9};  // Q0..Q7 -> LEDs
const uint8_t PIN_CLK  = 10;  // pulsador de reloj (flanco = al presionar)
const uint8_t PIN_CLR  = 11;  // pulsador de borrado asíncrono
const uint8_t PIN_DIR  = 12;  // switch DIR
const uint8_t PIN_SR   = A0;  // switch entrada serial para corrimiento a la derecha
const uint8_t PIN_SL   = A1;  // switch entrada serial para corrimiento a la izquierda
const uint8_t PIN_AUTO = A2;  // switch: 1 = reloj automático, 0 = reloj manual
const uint8_t PIN_TICK = 13;  // LED integrado: destella en cada flanco

// ---------------- Parámetros ----------------
const unsigned long PERIODO_AUTO_MS = 500;  // reloj automático de 2 Hz
const unsigned long REBOTE_MS       = 30;
const unsigned long TICK_MS         = 80;

// Pregunta 9: true = cada flip-flop recibe el flanco un poco después que el anterior
// (Q0 primero, Q7 al final), como si no compartieran el mismo reloj.
const bool SIMULAR_RELOJES_DESFASADOS = false;

// ---------------- Estado ----------------
bool Q[8] = {0};  // salidas de los flip-flops
bool D[8];        // entradas D = salidas de los multiplexores
bool P[8];        // datos de carga paralela
bool cargaPendiente = false;
unsigned long numFlanco = 0;

bool estadoBoton = false, lecturaPrevia = false;
unsigned long tCambio = 0, tUltimoAuto = 0, tTick = 0;
bool tickEncendido = false, clrActivo = false;

char buf[12];
uint8_t lenBuf = 0;

// ---------------- Lógica del registro ----------------
bool leer(uint8_t pin) { return digitalRead(pin) == LOW; }

bool mux2a1(bool sel, bool i0, bool i1) { return sel ? i1 : i0; }

bool salidaMux(int i, bool dir, bool sl, bool sr) {
  bool i0 = (i == 0) ? sl : Q[i - 1];  // DIR = 0: toma el bit de la posición inferior
  bool i1 = (i == 7) ? sr : Q[i + 1];  // DIR = 1: toma el bit de la posición superior
  return mux2a1(dir, i0, i1);
}

void actualizarLEDs() {
  for (int i = 0; i < 8; i++) digitalWrite(PIN_Q[i], Q[i] ? HIGH : LOW);
}

void imprimirQ() {
  for (int i = 7; i >= 0; i--) Serial.print(Q[i] ? '1' : '0');
}

void imprimirEstado() {
  Serial.print(F("Estado | DIR="));
  Serial.print(leer(PIN_DIR) ? F("1 (DER)") : F("0 (IZQ)"));
  Serial.print(F(" SL="));  Serial.print(leer(PIN_SL) ? '1' : '0');
  Serial.print(F(" SR="));  Serial.print(leer(PIN_SR) ? '1' : '0');
  Serial.print(F(" | Q7..Q0 = "));
  imprimirQ();
  Serial.println();
}

void flancoDeReloj() {
  bool dir  = leer(PIN_DIR);
  bool sl   = leer(PIN_SL);
  bool sr   = leer(PIN_SR);
  bool sale = dir ? Q[0] : Q[7];
  bool fueCarga = cargaPendiente;
  numFlanco++;

  if (fueCarga) {
    for (int i = 0; i < 8; i++) Q[i] = P[i];
    cargaPendiente = false;
  } else if (SIMULAR_RELOJES_DESFASADOS) {
    // Cada FF se actualiza antes de que el siguiente lea su entrada
    for (int i = 0; i < 8; i++) Q[i] = salidaMux(i, dir, sl, sr);
  } else {
    // 1) Los 8 multiplexores calculan D con el estado ACTUAL
    for (int i = 0; i < 8; i++) D[i] = salidaMux(i, dir, sl, sr);
    // 2) Los 8 flip-flops capturan D en el MISMO flanco
    for (int i = 0; i < 8; i++) Q[i] = D[i];
  }

  actualizarLEDs();
  digitalWrite(PIN_TICK, HIGH);
  tTick = millis();
  tickEncendido = true;

  Serial.print(F("CLK #"));
  Serial.print(numFlanco);
  if (fueCarga) {
    Serial.print(F(" | CARGA PARALELA"));
  } else {
    Serial.print(dir ? F(" | DER") : F(" | IZQ"));
    Serial.print(F(" | SL=")); Serial.print(sl ? '1' : '0');
    Serial.print(F(" SR="));   Serial.print(sr ? '1' : '0');
    Serial.print(F(" | sale=")); Serial.print(sale ? '1' : '0');
  }
  Serial.print(F(" | Q7..Q0 = "));
  imprimirQ();
  Serial.println();
}

// ---------------- Entradas ----------------
bool flancoBoton() {
  bool lectura = leer(PIN_CLK);
  if (lectura != lecturaPrevia) {
    tCambio = millis();
    lecturaPrevia = lectura;
  }
  if (millis() - tCambio >= REBOTE_MS && lectura != estadoBoton) {
    estadoBoton = lectura;
    if (estadoBoton) return true;  // se acaba de presionar
  }
  return false;
}

void procesarComando() {
  buf[lenBuf] = '\0';
  if (lenBuf == 1 && buf[0] == '?') {
    imprimirEstado();
  } else if (lenBuf == 9 && (buf[0] == 'P' || buf[0] == 'p')) {
    bool valido = true;
    for (int k = 1; k <= 8; k++) {
      if (buf[k] != '0' && buf[k] != '1') valido = false;
    }
    if (valido) {
      for (int k = 0; k < 8; k++) P[7 - k] = (buf[1 + k] == '1');
      cargaPendiente = true;
      Serial.print(F("Carga paralela lista: "));
      Serial.print(buf + 1);
      Serial.println(F(" (se aplica en el siguiente flanco)"));
    } else {
      Serial.println(F("Formato: P seguido de 8 bits, p. ej. P10110011"));
    }
  } else if (lenBuf > 0) {
    Serial.println(F("Comandos: P10110011 = carga paralela | ? = estado"));
  }
  lenBuf = 0;
}

void leerSerie() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (lenBuf > 0) procesarComando();
      continue;
    }
    if (c == ' ') continue;
    buf[lenBuf++] = c;
    bool completo = (lenBuf == 1 && buf[0] == '?') ||
                    (lenBuf == 9 && (buf[0] == 'P' || buf[0] == 'p'));
    if (completo || lenBuf >= sizeof(buf) - 1) procesarComando();
  }
}

// ---------------- Programa principal ----------------
void setup() {
  for (int i = 0; i < 8; i++) pinMode(PIN_Q[i], OUTPUT);
  pinMode(PIN_TICK, OUTPUT);
  pinMode(PIN_CLK,  INPUT_PULLUP);
  pinMode(PIN_CLR,  INPUT_PULLUP);
  pinMode(PIN_DIR,  INPUT_PULLUP);
  pinMode(PIN_SR,   INPUT_PULLUP);
  pinMode(PIN_SL,   INPUT_PULLUP);
  pinMode(PIN_AUTO, INPUT_PULLUP);

  Serial.begin(9600);
  actualizarLEDs();

  Serial.println(F("Registro de corrimiento bidireccional de 8 bits"));
  Serial.println(F("DIR=0: izquierda (entra SL en Q0) | DIR=1: derecha (entra SR en Q7)"));
  Serial.println(F("Comandos: P10110011 = carga paralela | ? = estado"));
  imprimirEstado();
}

void loop() {
  bool pulso = flancoBoton();
  leerSerie();

  if (tickEncendido && millis() - tTick >= TICK_MS) {
    digitalWrite(PIN_TICK, LOW);
    tickEncendido = false;
  }

  // CLR asíncrono: tiene prioridad sobre el reloj
  if (leer(PIN_CLR)) {
    if (!clrActivo) {
      for (int i = 0; i < 8; i++) Q[i] = false;
      actualizarLEDs();
      Serial.println(F("CLR | Q7..Q0 = 00000000"));
      clrActivo = true;
    }
    return;
  }
  clrActivo = false;

  if (leer(PIN_AUTO)) {
    if (millis() - tUltimoAuto >= PERIODO_AUTO_MS) {
      tUltimoAuto = millis();
      flancoDeReloj();
    }
  } else if (pulso) {
    flancoDeReloj();
  }
}
