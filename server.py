"""喫茶店 Kissaten de Kenji (Sandō) — servidor local de la app.

Sirve la web (carpeta web/), guarda la partida en datos/partida.json y hace de
puente hacia la IA local: primero Qwen (EXL3, :8888), si no Ollama (:11434).
Solo stdlib. Uso:  python server.py [--puerto 8774] [--no-abrir]
"""
import json
import mimetypes
import os
import re
import shutil
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
WEB = RAIZ / 'web'
DATOS = RAIZ / 'datos'
PARTIDA = DATOS / 'partida.json'
PUERTO = 8774

BACKENDS = [
    {'nombre': 'Qwen local (EXL3)', 'base': 'http://127.0.0.1:8888/v1',
     'extra': {'chat_template_kwargs': {'enable_thinking': False}}},
    {'nombre': 'Ollama', 'base': 'http://127.0.0.1:11434/v1',
     'extra': {'reasoning_effort': 'low'}, 'preferidos': ['gpt-oss:20b', 'qwen', 'gemma', 'llama']},
]
# Versión del código con la que arrancó el servidor: iniciar.pyw la compara con la de los archivos
# actuales y, si cambiaron (ej: después de un git pull), reinicia el servidor.
def version_codigo():
    archivos = [Path(__file__).resolve()]
    return str(int(sum(f.stat().st_mtime for f in archivos if f.exists())))


VERSION = version_codigo()
_cache_modelos = {}  # base -> (instante, id_modelo | None)
_lock_partida = threading.Lock()


mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/manifest+json', '.webmanifest')


def _get_json(url, timeout=2.5):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def modelo_de(backend):
    """Devuelve el id de modelo disponible en ese backend (o None). Cachea 20 s."""
    base = backend['base']
    hit = _cache_modelos.get(base)
    if hit and time.time() - hit[0] < 20:
        return hit[1]
    modelo = None
    try:
        ids = [m.get('id') for m in _get_json(base + '/models').get('data', [])]
        ids = [i for i in ids if i and 'minilm' not in i and 'embed' not in i]
        for pref in backend.get('preferidos', []):
            match = [i for i in ids if i.startswith(pref)]
            if match:
                modelo = match[0]
                break
        if not modelo and ids:
            modelo = ids[0]
    except Exception:
        modelo = None
    _cache_modelos[base] = (time.time(), modelo)
    return modelo


def limpiar(texto):
    texto = re.sub(r'<think>.*?</think>', '', texto or '', flags=re.S)
    if '</think>' in texto:
        texto = texto.split('</think>', 1)[1]
    return texto.strip()


def extraer_json(texto):
    """Saca el primer objeto JSON de la respuesta (tolera ```json ... ```)."""
    texto = limpiar(texto)
    m = re.search(r'```(?:json)?\s*(.*?)```', texto, re.S)
    if m:
        texto = m.group(1)
    ini = texto.find('{')
    if ini < 0:
        return None
    prof = 0
    en_str = esc = False
    for i in range(ini, len(texto)):
        c = texto[i]
        if en_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                en_str = False
        elif c == '"':
            en_str = True
        elif c == '{':
            prof += 1
        elif c == '}':
            prof -= 1
            if prof == 0:
                try:
                    return json.loads(texto[ini:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def preguntar_ia(mensajes, quiere_json=False, temperatura=0.7, max_tokens=900):
    errores = []
    for b in BACKENDS:
        modelo = modelo_de(b)
        if not modelo:
            errores.append(f"{b['nombre']}: apagado")
            continue
        cuerpo = {'model': modelo, 'messages': mensajes, 'temperature': temperatura,
                  'max_tokens': max_tokens, 'stream': False, **b['extra']}
        req = urllib.request.Request(b['base'] + '/chat/completions', method='POST',
                                     data=json.dumps(cuerpo).encode('utf-8'),
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                resp = json.loads(r.read().decode('utf-8'))
            texto = resp['choices'][0]['message'].get('content') or ''
            salida = {'ok': True, 'backend': b['nombre'], 'modelo': modelo, 'texto': limpiar(texto)}
            if quiere_json:
                salida['json'] = extraer_json(texto)
                if salida['json'] is None:
                    errores.append(f"{b['nombre']}: respuesta sin JSON")
                    continue
            return salida
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as e:
            _cache_modelos.pop(b['base'], None)
            errores.append(f"{b['nombre']}: {e}")
    return {'ok': False, 'error': '; '.join(errores) or 'sin IA'}


class Manejador(BaseHTTPRequestHandler):
    server_version = 'sando-cafe/1.0'

    def log_message(self, fmt, *args):  # silencioso
        pass

    def _responder(self, codigo, cuerpo, tipo='application/json; charset=utf-8', extra=None):
        if isinstance(cuerpo, (dict, list)):
            cuerpo = json.dumps(cuerpo, ensure_ascii=False).encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Cache-Control', 'no-cache')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(cuerpo)

    def _leer_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 80_000_000:
            raise ValueError('demasiado grande')
        return json.loads(self.rfile.read(n).decode('utf-8') or '{}')

    def _mismo_origen(self):
        # Solo aceptamos POST desde la propia página (evita que otra web toque la partida o la IA).
        origen = self.headers.get('Origin')
        return origen is None or origen in (f'http://127.0.0.1:{PUERTO}', f'http://localhost:{PUERTO}')

    def do_GET(self):
        ruta = self.path.split('?', 1)[0]
        if ruta == '/api/partida':
            if PARTIDA.exists():
                return self._responder(200, PARTIDA.read_bytes())
            return self._responder(200, {})
        if ruta == '/api/version':
            return self._responder(200, {'version': VERSION})
        if ruta == '/api/ia/estado':
            for b in BACKENDS:
                m = modelo_de(b)
                if m:
                    return self._responder(200, {'ok': True, 'backend': b['nombre'], 'modelo': m})
            return self._responder(200, {'ok': False})
        if ruta == '/':
            ruta = '/index.html'
        archivo = (WEB / ruta.lstrip('/')).resolve()
        if WEB not in archivo.parents or not archivo.is_file():
            return self._responder(404, {'error': 'no existe'})
        tipo = mimetypes.guess_type(str(archivo))[0] or 'application/octet-stream'
        if tipo.startswith('text/') or tipo.endswith('javascript'):
            tipo += '; charset=utf-8'
        self._responder(200, archivo.read_bytes(), tipo)

    def do_POST(self):
        if not self._mismo_origen():
            return self._responder(403, {'error': 'origen no permitido'})
        ruta = self.path.split('?', 1)[0]
        try:
            datos = self._leer_json()
        except Exception as e:
            return self._responder(400, {'error': str(e)})
        if ruta == '/api/apagar':
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return self._responder(200, {'ok': True})
        if ruta == '/api/partida':
            with _lock_partida:
                DATOS.mkdir(exist_ok=True)
                if PARTIDA.exists():  # respaldo diario
                    resp = DATOS / f"partida-{time.strftime('%Y%m%d')}.json"
                    if not resp.exists():
                        shutil.copy2(PARTIDA, resp)
                tmp = PARTIDA.with_suffix('.tmp')
                tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding='utf-8')
                tmp.replace(PARTIDA)
            return self._responder(200, {'ok': True})
        if ruta == '/api/ia':
            msgs = datos.get('mensajes') or []
            if not msgs:
                return self._responder(400, {'error': 'faltan mensajes'})
            r = preguntar_ia(msgs, bool(datos.get('json')), float(datos.get('temperatura', 0.7)),
                             int(datos.get('max_tokens', 900)))
            return self._responder(200, r)
        self._responder(404, {'error': 'ruta desconocida'})


def avisar(txt):
    # con pythonw no hay consola (stdout es None); en consolas cp1252 los kanji fallan
    if sys.stdout:
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            print(txt, flush=True)
        except Exception:
            pass


def main():
    global PUERTO
    args = sys.argv[1:]
    if os.environ.get('PORT', '').isdigit():
        PUERTO = int(os.environ['PORT'])
    if '--datos' in args:  # carpeta de partida alternativa (para pruebas)
        global DATOS, PARTIDA
        DATOS = Path(args[args.index('--datos') + 1]).resolve()
        PARTIDA = DATOS / 'partida.json'
    if '--puerto' in args:
        PUERTO = int(args[args.index('--puerto') + 1])
    try:
        srv = ThreadingHTTPServer(('127.0.0.1', PUERTO), Manejador)
    except OSError:
        avisar(f'Ya hay algo en el puerto {PUERTO}; abro el navegador igual.')
        srv = None
    url = f'http://127.0.0.1:{PUERTO}/'
    if '--no-abrir' not in args:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    if srv:
        avisar(f'喫茶店 Kissaten de Kenji en {url}')
        srv.serve_forever()
        srv.server_close()


if __name__ == '__main__':
    main()
