'use client';

// ISNet int8 weights: chenjindu/isnet-web (Apache-2.0).
// Inference stays in the browser; only the finished PNG is uploaded to the user's private bucket.
import * as ort from 'onnxruntime-web/wasm';

const size = 1024;
const pixels = size * size;
let sessionPromise: Promise<ort.InferenceSession> | undefined;

async function getSession(progress: (step: string) => void) {
  if (!sessionPromise) sessionPromise = (async () => {
    progress('Baixando modelo gratuito (45 MB)…');
    const names = ['isnet-w8.part00', 'isnet-w8.part01', 'isnet-w8.part02'];
    const parts = await Promise.all(names.map(async name => {
      const response = await fetch(`/models/isnet/${name}`);
      if (!response.ok) throw new Error('Não consegui baixar o modelo de recorte. Confira sua conexão.');
      return new Uint8Array(await response.arrayBuffer());
    }));
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    if (total < 40_000_000 || total > 55_000_000) throw new Error('O modelo de recorte veio incompleto.');
    const weights = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { weights.set(part, offset); offset += part.byteLength; }
    progress('Preparando recorte no aparelho…');
    ort.env.wasm.wasmPaths = `${location.origin}/ort/`;
    ort.env.wasm.numThreads = 1;
    return ort.InferenceSession.create(weights, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  })().catch(error => { sessionPromise = undefined; throw error; });
  return sessionPromise;
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width; element.height = height;
  return element;
}

export async function removeWardrobeBackground(source: Blob, progress: (step: string) => void): Promise<Blob> {
  const session = await getSession(progress);
  progress('Identificando a roupa…');
  const image = await createImageBitmap(source);
  try {
    const inputCanvas = canvas(size, size);
    const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true });
    if (!inputContext) throw new Error('Este navegador não conseguiu abrir a imagem.');
    inputContext.drawImage(image, 0, 0, size, size);
    const rgba = inputContext.getImageData(0, 0, size, size).data;
    const rgb = new Float32Array(pixels * 3);
    for (let index = 0; index < pixels; index++) {
      rgb[index] = rgba[index * 4] / 255 - 0.5;
      rgb[pixels + index] = rgba[index * 4 + 1] / 255 - 0.5;
      rgb[2 * pixels + index] = rgba[index * 4 + 2] / 255 - 0.5;
    }
    const results = await session.run({ input_image: new ort.Tensor('float32', rgb, [1, 3, size, size]) });
    const output = results.output_image?.data;
    if (!output || output.length < pixels) throw new Error('O recorte não retornou uma máscara válida.');
    let low = Infinity; let high = -Infinity;
    for (let index = 0; index < pixels; index++) {
      const value = Number(output[index]);
      if (value < low) low = value;
      if (value > high) high = value;
    }
    if (!Number.isFinite(low) || high - low < 0.000001) throw new Error('A foto não permitiu identificar a roupa. Tente outra imagem.');
    progress('Finalizando imagem sem fundo…');
    const mask = canvas(size, size);
    const maskContext = mask.getContext('2d');
    if (!maskContext) throw new Error('Este navegador não conseguiu finalizar a imagem.');
    const maskPixels = maskContext.createImageData(size, size);
    for (let index = 0; index < pixels; index++) {
      const alpha = Math.round((Number(output[index]) - low) * 255 / (high - low));
      maskPixels.data[index * 4] = 255;
      maskPixels.data[index * 4 + 1] = 255;
      maskPixels.data[index * 4 + 2] = 255;
      maskPixels.data[index * 4 + 3] = Math.max(0, Math.min(255, alpha));
    }
    maskContext.putImageData(maskPixels, 0, 0);
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const result = canvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    const context = result.getContext('2d');
    if (!context) throw new Error('Este navegador não conseguiu salvar a imagem.');
    context.drawImage(image, 0, 0, result.width, result.height);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0, result.width, result.height);
    const blob = await new Promise<Blob | null>(resolve => result.toBlob(resolve, 'image/png'));
    if (!blob || blob.size > 8 * 1024 * 1024) throw new Error('O recorte ficou grande demais. Tente uma foto menor.');
    return blob;
  } finally { image.close(); }
}
