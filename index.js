import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import process from 'node:process';

const APP_NAME = 'VidaMRR Manager';
const DATA_FILE = path.join(process.cwd(), 'videos.json');

const state = {
  mode: 'command',
  commandInput: '',
  urlInput: '',
  videos: [],
  selectedVideo: 0,
  selectedDetail: 0,
  focus: 'videos',
  status: 'Escribe /new o /view. /help para ver comandos.',
  busy: false,
};

function loadVideos() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVideos() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state.videos, null, 2));
}

function truncate(text, max = 74) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function clear() {
  process.stdout.write('\x1Bc');
}

function getSelectedVideo() {
  if (state.videos.length === 0) return null;
  const index = Math.max(0, Math.min(state.selectedVideo, state.videos.length - 1));
  return state.videos[index];
}

function getDetailRows(video) {
  if (!video) return [];
  return [
    { key: 'titulo', label: 'Titulo', value: video.title },
    { key: 'thumbnail', label: 'Thumbnail', value: video.thumbnail },
    { key: 'url', label: 'URL', value: video.url },
  ];
}

function renderHeader() {
  const busyText = state.busy ? ' [PROCESANDO]' : '';
  return `${APP_NAME}${busyText}`;
}

function renderCommands() {
  return [
    'Comandos:',
    '  /new <url>   Registrar video de YouTube',
    '  /view        Ver videos guardados',
    '  /help        Mostrar ayuda',
    '  /quit        Salir',
    '',
    'Atajos en /view:',
    '  Flechas: navegar',
    '  Tab: cambiar foco',
    '  Enter: copiar item al portapapeles',
  ];
}

function renderVideos() {
  const lines = ['Videos guardados:'];
  if (state.videos.length === 0) {
    lines.push('  (sin videos)');
    return lines;
  }

  state.videos.forEach((video, index) => {
    const isSelected = state.selectedVideo === index;
    const pointer = isSelected ? (state.focus === 'videos' ? '>' : '*') : ' ';
    lines.push(`${pointer} ${index + 1}. ${truncate(video.title, 68)}`);
  });

  return lines;
}

function renderDetails() {
  const video = getSelectedVideo();
  const lines = ['Detalle:'];
  if (!video) {
    lines.push('  Selecciona un video con /view');
    return lines;
  }

  const details = getDetailRows(video);
  state.selectedDetail = Math.min(state.selectedDetail, details.length - 1);

  details.forEach((row, index) => {
    const isSelected = state.selectedDetail === index;
    const pointer = isSelected ? (state.focus === 'details' ? '>' : '*') : ' ';
    lines.push(`${pointer} ${row.label}: ${truncate(row.value, 64)}`);
  });

  return lines;
}

function renderInputLine() {
  if (state.mode === 'prompt_url') {
    return `URL YouTube: ${state.urlInput}`;
  }
  return `Input: ${state.commandInput}`;
}

function renderStatusLine() {
  return `Estado: ${state.status}`;
}

function draw() {
  clear();
  const sections = [
    renderHeader(),
    ''.padEnd(90, '='),
    ...renderCommands(),
    ''.padEnd(90, '-'),
    ...renderVideos(),
    ''.padEnd(90, '-'),
    ...renderDetails(),
    ''.padEnd(90, '-'),
    renderInputLine(),
    renderStatusLine(),
  ];
  process.stdout.write(`${sections.join('\n')}\n`);
}

async function fetchYouTubeMeta(url) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      throw new Error('No se pudo extraer metadata del video.');
    }
    const data = await res.json();
    if (!data.title || !data.thumbnail_url) {
      throw new Error('Respuesta incompleta de YouTube.');
    }
    return {
      title: data.title,
      thumbnail: data.thumbnail_url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function copyToClipboard(value) {
  return new Promise((resolve, reject) => {
    let command = null;
    let args = [];

    if (process.platform === 'darwin') {
      command = 'pbcopy';
    } else if (process.platform === 'win32') {
      command = 'clip';
    } else {
      command = 'xclip';
      args = ['-selection', 'clipboard'];
    }

    const child = spawn(command, args);
    child.on('error', (err) => reject(new Error(`No se pudo usar portapapeles (${err.message}).`)));
    child.stdin.write(value);
    child.stdin.end();
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('No se pudo copiar al portapapeles.'));
    });
  });
}

function normalizeYoutubeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function registerVideo(rawUrl) {
  const url = normalizeYoutubeUrl(rawUrl.trim());
  if (!url) {
    state.status = 'URL invalida. Debe ser un enlace de YouTube.';
    return;
  }

  state.busy = true;
  state.status = 'Extrayendo metadata...';
  draw();

  try {
    const meta = await fetchYouTubeMeta(url);
    const exists = state.videos.some((video) => video.url === url);
    if (exists) {
      state.status = 'Ese video ya existe en la lista.';
      return;
    }

    state.videos.push({
      id: Date.now().toString(36),
      url,
      title: meta.title,
      thumbnail: meta.thumbnail,
      createdAt: new Date().toISOString(),
    });
    saveVideos();
    state.selectedVideo = state.videos.length - 1;
    state.mode = 'view';
    state.focus = 'videos';
    state.status = 'Video registrado correctamente.';
  } catch (error) {
    state.status = error instanceof Error ? error.message : 'No se pudo registrar el video.';
  } finally {
    state.busy = false;
  }
}

async function executeCommand(raw) {
  const input = raw.trim();
  if (!input) {
    state.status = 'Escribe un comando.';
    return;
  }

  const [command, ...rest] = input.split(' ');

  if (command === '/help') {
    state.status = 'Comandos disponibles: /new /view /help /quit';
    return;
  }

  if (command === '/quit' || command === '/exit') {
    process.exit(0);
  }

  if (command === '/view') {
    state.mode = 'view';
    state.focus = 'videos';
    if (state.videos.length > 0) {
      state.selectedVideo = Math.min(state.selectedVideo, state.videos.length - 1);
    }
    state.status = `Mostrando ${state.videos.length} video(s).`;
    return;
  }

  if (command === '/new') {
    const maybeUrl = rest.join(' ').trim();
    if (!maybeUrl) {
      state.mode = 'prompt_url';
      state.urlInput = '';
      state.status = 'Pega una URL de YouTube y presiona Enter.';
      return;
    }
    await registerVideo(maybeUrl);
    return;
  }

  state.status = `Comando desconocido: ${command}`;
}

async function copyCurrentSelection() {
  const video = getSelectedVideo();
  if (!video) {
    state.status = 'No hay video seleccionado.';
    return;
  }

  if (state.focus === 'videos') {
    await copyToClipboard(video.url);
    state.status = 'URL del video copiada al portapapeles.';
    return;
  }

  const details = getDetailRows(video);
  const row = details[state.selectedDetail];
  if (!row) {
    state.status = 'No hay detalle seleccionado.';
    return;
  }
  await copyToClipboard(row.value);
  state.status = `${row.label} copiado al portapapeles.`;
}

function moveSelection(delta) {
  if (state.mode !== 'view') {
    return;
  }

  if (state.focus === 'videos') {
    if (state.videos.length === 0) return;
    const next = state.selectedVideo + delta;
    state.selectedVideo = Math.max(0, Math.min(next, state.videos.length - 1));
    return;
  }

  const video = getSelectedVideo();
  if (!video) return;
  const details = getDetailRows(video);
  const next = state.selectedDetail + delta;
  state.selectedDetail = Math.max(0, Math.min(next, details.length - 1));
}

async function onEnter() {
  if (state.busy) return;

  if (state.mode === 'prompt_url') {
    const url = state.urlInput;
    state.urlInput = '';
    state.mode = 'command';
    await registerVideo(url);
    return;
  }

  if (state.mode === 'view') {
    try {
      await copyCurrentSelection();
    } catch (error) {
      state.status = error instanceof Error ? error.message : 'Fallo al copiar al portapapeles.';
    }
    return;
  }

  const command = state.commandInput;
  state.commandInput = '';
  await executeCommand(command);
}

function appendInput(ch) {
  if (!ch || ch.length !== 1) return;
  if (state.mode === 'prompt_url') {
    state.urlInput += ch;
    return;
  }
  state.commandInput += ch;
}

function backspaceInput() {
  if (state.mode === 'prompt_url') {
    state.urlInput = state.urlInput.slice(0, -1);
    return;
  }
  state.commandInput = state.commandInput.slice(0, -1);
}

function bootstrap() {
  state.videos = loadVideos();

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }

    if (key.name === 'escape') {
      state.mode = 'command';
      state.status = 'Modo comando activo.';
      draw();
      return;
    }

    if (key.name === 'tab' && state.mode === 'view') {
      state.focus = state.focus === 'videos' ? 'details' : 'videos';
      draw();
      return;
    }

    if (key.name === 'up') {
      moveSelection(-1);
      draw();
      return;
    }

    if (key.name === 'down') {
      moveSelection(1);
      draw();
      return;
    }

    if (key.name === 'backspace') {
      backspaceInput();
      draw();
      return;
    }

    if (key.name === 'return') {
      await onEnter();
      draw();
      return;
    }

    if (key.name === 'q' && state.mode === 'view') {
      state.mode = 'command';
      state.status = 'Modo comando activo.';
      draw();
      return;
    }

    if (!key.ctrl && !key.meta) {
      appendInput(str);
      draw();
    }
  });

  draw();
}

bootstrap();
