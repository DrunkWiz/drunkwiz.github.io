/* index.html only. Loaded by extras.js when the arcade shelf scrolls near, before arcade.js.
   Palettes, a 3x5 pixel font and every sprite on the shelf, as code: each sprite is rows of
   palette indices, 0 the lightest to 3 the darkest, '.' clear. sheet() draws a sprite once into
   an offscreen canvas for a palette; that canvas is what the games draw from.
   Exporting PNG sheets later (to retouch in an editor) is one canvas.toDataURL() per sprite. */
(function () {
  /* ---- Palettes: four shades per machine, lightest first. Made up, not sampled from any real screen. */
  var PAL = {
    pocket: ['#E1ECBA', '#9FBE76', '#4F7745', '#1C3326']
  };

  /* ---- 3x5 font: five rows of three bits, top to bottom. Glyphs are 3 wide with 1px between. */
  var F = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '.': '000000000000010', ':': '000010000010000', '!': '010010010000010', '?': '110001010000010',
    '-': '000000111000000', '/': '001001010100100', "'": '010010000000000', ',': '000000000010100', '(': '001010010010001',
    ')': '100010010010100', '#': '101111101111101', '+': '000010111010000', '>': '100010001010100', '<': '001010100010001',
    '%': '101001010100101', '=': '000111000111000', '*': '000101010101000', ' ': '000000000000000'
  };
  function textWidth(s) { return String(s).length * 4 - 1; }
  // Draws text in one colour. align: 'left' | 'center' | 'right'.
  function text(ctx, s, x, y, color, align) {
    s = String(s).toUpperCase();
    if (align === 'center') x = Math.round(x - textWidth(s) / 2);
    else if (align === 'right') x = x - textWidth(s);
    ctx.fillStyle = color;
    for (var i = 0; i < s.length; i++) {
      var g = F[s[i]] || F['?'];
      for (var b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + i * 4 + (b % 3), y + ((b / 3) | 0), 1, 1);
    }
  }

  /* ---- Sprite sheets: one canvas per sprite per palette, drawn once and cached. */
  var cache = {};
  function sheet(key, rows, pal, flip) {
    var k = key + '|' + pal.join() + (flip ? '|f' : '');
    if (cache[k]) return cache[k];
    var h = rows.length, w = rows[0].length, c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var ch = rows[y][flip ? w - 1 - i : i];
      if (ch === '.') continue;
      x.fillStyle = pal[+ch]; x.fillRect(i, y, 1, 1);
    }
    return (cache[k] = c);
  }

  /* ---- Fish. Per pond: 5 commons, 1 uncommon, 1 rare, 1 night fish. All made up.
     The pocket pond is old playgrounds and childhood games; its rare is the dragon playground.
     size: length range in cm. where: the part of the pond it lives in (near or far cast, or any). */
  var FISH = {
    pocket: [
      { id: 'pk-kuti', name: 'Kuti Kuti Fry', rarity: 'common', where: 'near', size: [2, 5],
        desc: 'Clear plastic, sold by the packet. Flick it and it goes.',
        px: ['........333.....', '333.....300333..', '31133..30000033.', '3111133000000003', '3111133000000003', '31133..30000003.', '333.....333333..', '................'] },
      { id: 'pk-pebble', name: 'Five Stones Pebblefish', rarity: 'common', where: 'near', size: [4, 9],
        desc: 'Travels in fives. One is always under the sofa.',
        px: ['........3333....', '.3...3331111333.', '3133311111113013', '3111111211111113', '3111111111111213', '3133311121111113', '.3...3331111333.', '........3333....'] },
      { id: 'pk-chapteh', name: 'Chapteh Feathertail', rarity: 'common', where: 'far', size: [10, 22],
        desc: 'Kept up by the side of a foot. Its tail never lands.',
        px: ['............333.....', '333..........3033...', '322333.....33000033.', '322222333.3000000303', '32222222232000000003', '32222222232000000003', '322222333.3000000003', '322333.....33000033.', '333..........3333...', '....................'] },
      { id: 'pk-ribbon', name: 'Rubber Band Ribbonfish', rarity: 'common', where: 'any', size: [20, 45],
        desc: 'Knotted from a hundred rubber bands. Jump it at ankle height first.',
        px: ['............................', '.........33333333333333.....', '333..3333211121112111303333.', '3113321112111211121112111113', '3113321112111211121112111113', '333..3333211121112111213333.', '.........33333333333333.....', '............................'] },
      { id: 'pk-melon', name: 'Watermelon Puffer', rarity: 'common', where: 'far', size: [12, 25],
        desc: 'Round and striped. There is a slide inside.',
        px: ['..........3333......', '.......3331112333...', '33....311211121113..', '313..31112111213013.', '31133211121112111113', '31111211121112111113', '31111211121112111113', '31133211121112111113', '313..31112111211113.', '33....311211121113..', '.......3331112333...', '..........3333......'] },
      { id: 'pk-pelican', name: 'Pelican Gulper', rarity: 'uncommon', where: 'far', size: [20, 38],
        desc: 'Swallows the hook, the sinker, then sits there.',
        px: ['............3333........', '33...........322333333..', '3033......3332222222223.', '33333...3322222222222223', '....33332222222222230223', '....30000000000000000003', '....30000000000000000003', '....33330000000000000003', '33333...3300000000000003', '3033......3330000000003.', '33...........333333333..', '........................'] },
      { id: 'pk-dragonet', name: 'Terrazzo Dragonet', rarity: 'rare', where: 'far', size: [25, 40],
        desc: 'Tiled head, terrazzo body, sandpit underneath. Older than the block next to it.',
        px: ['..............33333.........', '33..............3313........', '313.........333311113333....', '33133.....3311111131111133..', '..3333...311131111111130313.', '.....33331111111111311111113', '.....31111111131111111111313', '.....31113111111111131111113', '.....33330000000000000000003', '..3333...300000000000000003.', '33133.....3300000000000033..', '313.........333300003333....', '33..............3333........', '............................'] },
      { id: 'pk-eel', name: 'Pontianak Eel', rarity: 'night', where: 'near', size: [30, 60],
        desc: 'Smells of frangipani. Do not say it looks nice.',
        px: ['................................', '.........333333333333333333.....', '333...333000000000000000300333..', '30033300000000000000000000000033', '30033300000000000000000000000033', '333...333000000000000000000333..', '.........333333333333333333.....', '................................'] }
    ]
  };

  /* ---- The angler, seen from behind on the jetty, and the float. */
  var ANGLER = ['....3333....', '...322223...', '.3333333333.', '..32222223..', '..32222223..', '...333333...', '..30000003..', '.3000000003.', '300000000003', '300033000003', '300000000003', '333333333333'];
  var FLOAT = ['.3.', '323', '303', '.3.'];
  var BITE = ['.3.', '.3.', '.3.', '...', '.3.'];   // the "!" over the float

  window.drunkwizArt = { PAL: PAL, FISH: FISH, ANGLER: ANGLER, FLOAT: FLOAT, BITE: BITE, sheet: sheet, text: text, textWidth: textWidth };
})();
