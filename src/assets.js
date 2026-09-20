/* 夺旗猫跑酷 · 素材：WebP 序列帧、GIF 解码回退、角色染色 */
(function (ns) {
  function material(files) {
    return { files, frames: [], tinted: null, frame: 0, timer: 0, ready: false };
  }

  const mats = {
    mechaRun: material(Array.from({ length: 12 }, (_, i) => `assets/mecha-cat-run/frames/frame_${String(i + 1).padStart(3, "0")}.webp`)),
    mechaJump: material(Array.from({ length: 12 }, (_, i) => `assets/mecha-cat-jump/frames/frame_${String(i + 1).padStart(3, "0")}.webp`)),
    dazhuangRun: material(Array.from({ length: 24 }, (_, i) => `assets/hercules-sprite-run/frames/frame_${String(i + 1).padStart(3, "0")}.webp`)),
    dazhuangJump: material(Array.from({ length: 24 }, (_, i) => `assets/hercules-jump/frames/frame_${String(i + 1).padStart(3, "0")}.webp`)),
    coin: material([
      "assets/coin/slices/front.webp",
      "assets/coin/slices/front_right.webp",
      "assets/coin/slices/right.webp",
      "assets/coin/slices/back_right.webp",
      "assets/coin/slices/back.webp",
      "assets/coin/slices/back_left.webp",
      "assets/coin/slices/left.webp",
      "assets/coin/slices/front_left.webp",
    ]),
  };

  const fallbackImage = {
    cat: new Image(),
    coin: new Image(),
  };
  fallbackImage.cat.src = "assets/fallback/cat-preview.gif";
  fallbackImage.coin.src = "assets/coin/preview.gif";

  const gifAssets = { cat: { frames: [], frame: 0, timer: 0, ready: false }, coin: { frames: [], frame: 0, timer: 0, ready: false } };

  function loadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  /* 用 hue-rotate 把小黑序列帧改成第三个角色的毛色 */
  function tintFrames(frames, degrees) {
    if (!frames.length) return [];
    const probe = document.createElement("canvas").getContext("2d");
    const supported = typeof probe.filter === "string";
    return frames.map((image) => {
      const out = document.createElement("canvas");
      out.width = image.naturalWidth;
      out.height = image.naturalHeight;
      const ctx = out.getContext("2d");
      if (supported) ctx.filter = `hue-rotate(${degrees}deg) saturate(0.82) brightness(1.12)`;
      ctx.drawImage(image, 0, 0);
      ctx.filter = "none";
      return out;
    });
  }

  async function loadMaterial(key) {
    const mat = mats[key];
    const frames = await Promise.all(mat.files.map(loadImage));
    mat.frames = frames.filter(Boolean);
    mat.ready = mat.frames.length > 0;
    return mat;
  }

  async function decodeFallback(url, asset) {
    try {
      const buffer = await fetch(url).then((response) => response.arrayBuffer());
      const frames = decodeGif(buffer);
      asset.frames = frames.map((frame) => {
        const canvas = document.createElement("canvas");
        canvas.width = frame.width;
        canvas.height = frame.height;
        canvas.getContext("2d").putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
        return { canvas, delay: Math.max(40, frame.delay) };
      });
      asset.ready = asset.frames.length > 0;
    } catch (error) {
      console.warn("GIF 回退素材解码失败（file:// 下属正常）", error);
    }
  }

  async function loadAll() {
    await Promise.all(Object.keys(mats).map(loadMaterial));
    mats.mechaTinted = { ...mats.mechaRun };
    mats.mechaJumpTinted = { ...mats.mechaJump };
    mats.mechaTinted.frames = tintFrames(mats.mechaRun.frames, 200);
    mats.mechaJumpTinted.frames = tintFrames(mats.mechaJump.frames, 200);
    mats.mechaTinted.ready = mats.mechaTinted.frames.length > 0;
    mats.mechaJumpTinted.ready = mats.mechaJumpTinted.frames.length > 0;
    await Promise.all([decodeFallback(fallbackImage.cat.src, gifAssets.cat), decodeFallback(fallbackImage.coin.src, gifAssets.coin)]);
    return ns.assets;
  }

  function advanceMaterial(mat, dt, frameDuration, holdLast) {
    if (!mat.ready || !mat.frames.length) return;
    mat.timer += dt;
    while (mat.timer >= frameDuration) {
      mat.timer -= frameDuration;
      mat.frame = holdLast ? Math.min(mat.frame + 1, mat.frames.length - 1) : (mat.frame + 1) % mat.frames.length;
    }
  }

  function advance(dt, speed, action) {
    const jump = action === "jump";
    const runDuration = Math.max(0.038, 0.098 - speed / 14000);
    if (jump) {
      advanceMaterial(mats.mechaJump, dt, 0.05, true);
      advanceMaterial(mats.mechaJumpTinted, dt, 0.05, true);
      advanceMaterial(mats.dazhuangJump, dt, 0.044, true);
    } else {
      advanceMaterial(mats.mechaRun, dt, runDuration * 1.12);
      advanceMaterial(mats.mechaTinted, dt, runDuration * 1.12);
      advanceMaterial(mats.dazhuangRun, dt, runDuration);
    }
    advanceMaterial(mats.coin, dt, 0.072);
    advanceGif(gifAssets.coin, dt);
    advanceGif(gifAssets.cat, dt);
  }

  function resetPose() {
    for (const mat of [mats.mechaJump, mats.mechaJumpTinted, mats.dazhuangJump]) {
      mat.frame = 0;
      mat.timer = 0;
    }
  }

  function advanceGif(asset, dt) {
    if (!asset.ready || asset.frames.length <= 1) return;
    asset.timer += dt * 1000;
    if (asset.timer >= asset.frames[asset.frame].delay) {
      asset.timer = 0;
      asset.frame = (asset.frame + 1) % asset.frames.length;
    }
  }

  /* 返回当前应绘制的一帧（canvas/Image），全部素材缺失时返回 null 由渲染层画像素块 */
  function catFrame(character, action) {
    const table = {
      xiaohei: { run: mats.mechaRun, jump: mats.mechaJump },
      dazhuang: { run: mats.dazhuangRun, jump: mats.dazhuangJump },
      snowball: { run: mats.mechaTinted, jump: mats.mechaJumpTinted },
    };
    const set = table[character.id] || table.xiaohei;
    const mat = action === "jump" ? set.jump : set.run;
    if (mat && mat.ready) return mat.frames[mat.frame % mat.frames.length];
    if (gifAssets.cat.ready) return gifAssets.cat.frames[gifAssets.cat.frame].canvas;
    if (fallbackImage.cat.complete && fallbackImage.cat.naturalWidth) return fallbackImage.cat;
    return null;
  }

  function coinFrame(index) {
    if (mats.coin.ready) return mats.coin.frames[(mats.coin.frame + (index || 0)) % mats.coin.frames.length];
    if (gifAssets.coin.ready) return gifAssets.coin.frames[gifAssets.coin.frame].canvas;
    return null;
  }

  function decodeGif(buffer) {
    const data = new Uint8Array(buffer);
    let offset = 0;
    const readByte = () => data[offset++];
    const readWord = () => readByte() | (readByte() << 8);
    const readBytes = (count) => data.slice(offset, (offset += count));
    const signature = String.fromCharCode(...readBytes(6));
    if (!signature.startsWith("GIF")) return [];

    const width = readWord();
    const height = readWord();
    const packed = readByte();
    readByte();
    readByte();
    const globalColorTable = packed & 0x80 ? readColorTable(1 << ((packed & 0x07) + 1)) : null;
    const canvasPixels = new Uint8ClampedArray(width * height * 4);
    const frames = [];
    let gce = { delay: 100, transparentIndex: -1, disposal: 0 };

    while (offset < data.length) {
      const blockId = readByte();
      if (blockId === 0x3b) break;
      if (blockId === 0x21) {
        const label = readByte();
        if (label === 0xf9) {
          readByte();
          const flags = readByte();
          const delay = readWord() * 10;
          const transparentIndex = readByte();
          readByte();
          gce = { delay: delay || 100, transparentIndex: flags & 1 ? transparentIndex : -1, disposal: (flags >> 2) & 7 };
        } else {
          skipSubBlocks();
        }
        continue;
      }
      if (blockId !== 0x2c) break;

      const left = readWord();
      const top = readWord();
      const frameWidth = readWord();
      const frameHeight = readWord();
      const imagePacked = readByte();
      const localColorTable = imagePacked & 0x80 ? readColorTable(1 << ((imagePacked & 0x07) + 1)) : null;
      const interlaced = Boolean(imagePacked & 0x40);
      const minCodeSize = readByte();
      const compressed = readSubBlocks();
      const indexes = lzwDecode(minCodeSize, compressed, frameWidth * frameHeight);
      const orderedIndexes = interlaced ? deinterlace(indexes, frameWidth) : indexes;
      const table = localColorTable || globalColorTable;
      const previousPixels = new Uint8ClampedArray(canvasPixels);

      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const colorIndex = orderedIndexes[y * frameWidth + x];
          if (colorIndex === gce.transparentIndex) continue;
          const color = table[colorIndex] || [0, 0, 0];
          const target = ((top + y) * width + left + x) * 4;
          canvasPixels[target] = color[0];
          canvasPixels[target + 1] = color[1];
          canvasPixels[target + 2] = color[2];
          canvasPixels[target + 3] = 255;
        }
      }

      frames.push({ width, height, pixels: new Uint8ClampedArray(canvasPixels), delay: gce.delay });
      if (gce.disposal === 2) clearFrame(canvasPixels, left, top, frameWidth, frameHeight, width);
      if (gce.disposal === 3) canvasPixels.set(previousPixels);
    }

    return frames;

    function readColorTable(size) {
      const table = [];
      for (let index = 0; index < size; index += 1) table.push([readByte(), readByte(), readByte()]);
      return table;
    }

    function readSubBlocks() {
      const chunks = [];
      let total = 0;
      for (;;) {
        const size = readByte();
        if (size === 0) break;
        const chunk = readBytes(size);
        chunks.push(chunk);
        total += size;
      }
      const bytes = new Uint8Array(total);
      let write = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, write);
        write += chunk.length;
      }
      return bytes;
    }

    function skipSubBlocks() {
      for (;;) {
        const size = readByte();
        if (size === 0) break;
        offset += size;
      }
    }
  }

  function lzwDecode(minCodeSize, bytes, expectedLength) {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let dict = [];
    let bit = 0;
    let previous = null;
    const output = [];

    const reset = () => {
      dict = [];
      for (let index = 0; index < clearCode; index += 1) dict[index] = [index];
      dict[clearCode] = [];
      dict[endCode] = null;
      codeSize = minCodeSize + 1;
      previous = null;
    };

    const readCode = () => {
      let code = 0;
      for (let index = 0; index < codeSize; index += 1) {
        const byte = bytes[bit >> 3];
        code |= ((byte >> (bit & 7)) & 1) << index;
        bit += 1;
      }
      return code;
    };

    reset();
    while (bit < bytes.length * 8 && output.length < expectedLength) {
      const code = readCode();
      if (code === clearCode) {
        reset();
        continue;
      }
      if (code === endCode) break;
      let entry = dict[code];
      if (!entry && previous) entry = previous.concat(previous[0]);
      if (!entry) break;
      output.push(...entry);
      if (previous) {
        dict.push(previous.concat(entry[0]));
        if (dict.length === 1 << codeSize && codeSize < 12) codeSize += 1;
      }
      previous = entry;
    }
    return output.slice(0, expectedLength);
  }

  function deinterlace(indexes, width) {
    const rows = indexes.length / width;
    const result = new Array(indexes.length);
    let sourceRow = 0;
    for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
      for (let row = start; row < rows; row += step) {
        result.splice(row * width, width, ...indexes.slice(sourceRow * width, sourceRow * width + width));
        sourceRow += 1;
      }
    }
    return result;
  }

  function clearFrame(pixels, left, top, frameWidth, frameHeight, canvasWidth) {
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const target = ((top + y) * canvasWidth + left + x) * 4;
        pixels[target] = 0;
        pixels[target + 1] = 0;
        pixels[target + 2] = 0;
        pixels[target + 3] = 0;
      }
    }
  }

  ns.assets = {
    mats,
    loadAll,
    advance,
    resetPose,
    catFrame,
    coinFrame,
    get ready() {
      return mats.mechaRun.ready || mats.dazhuangRun.ready;
    },
  };
})(window.DQM);
