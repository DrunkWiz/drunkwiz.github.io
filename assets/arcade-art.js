/* index.html only. Loaded by extras.js when the arcade shelf scrolls near, before arcade.js.
   Palettes, a 3x5 pixel font and every sprite on the shelf, as code: each sprite is rows of
   palette indices, 0 the lightest to 3 the darkest, '.' clear. sheet() draws a sprite once into
   an offscreen canvas for a palette; that canvas is what the games draw from.
   Exporting PNG sheets later (to retouch in an editor) is one canvas.toDataURL() per sprite. */
(function () {
  /* ---- Palettes: four shades per machine, lightest first. Made up, not sampled from any real screen. */
  var PAL = {
    pocket: ['#E1ECBA', '#9FBE76', '#4F7745', '#1C3326'],
    // TV game: a limited set of 16. Each fish picks four of them (its own small palette, light to outline).
    tv: ['#0B0B12', '#F4F1E6', '#8A8A93', '#3B3B48', '#1E3F8A', '#3B7BD6', '#8CC3F0', '#1F6B3A',
         '#4DAE5A', '#C7E07A', '#8A4A1E', '#D98C3A', '#F2D26B', '#A8323A', '#E8718A', '#6B3FA0'],
    // Desktop: one bit. The two middle shades are dither patterns: d25 is a quarter black, d75 three quarters.
    desk: ['#FFFFFF', 'd25', 'd75', '#000000'],
    // Terminal: amber phosphor, brightest first, the black of the tube last.
    term: ['#FFB838', '#C9821C', '#6B420B', '#140C02']
  };
  // A fish's own four colours on a machine.
  // Desktop fish use a cleaner one-bit set than the scenery: white body, a half-dithered back, black outline.
  var DESK_FISH = ['#FFFFFF', '#FFFFFF', 'd50', '#000000'];
  function fishPal(pond, f) { return pond === 'tv' ? f.c.map(function (i) { return PAL.tv[i]; }) : pond === 'desk' ? DESK_FISH : PAL[pond]; }

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
    '%': '101001010100101', '=': '000111000111000', '*': '000101010101000', ' ': '000000000000000',
    '[': '110100100100110', ']': '011001001001011', '{': '011010110010011', '}': '110010011010110', '~': '000011110000000',
    '^': '010101000000000', '_': '000000000000111', '|': '010010010010010', ';': '000010000010100', '\u00B0': '010101010000000',
    '@': '010101111100011', '←': '001011111011001', '→': '100110111110100', '␣': '000000000101111', '↵': '001001101111100',   // the terminal's keys '\u2591': '101010101010101', '\u2588': '111111111111111'
  };
  function textWidth(s) { return String(s).length * 4 - 1; }
  // Draws text in one colour. align: 'left' | 'center' | 'right'.
  // k: pixel size, for machines with more pixels than the pocket one.
  function text(ctx, s, x, y, color, align, k) {
    s = String(s).toUpperCase(); k = k || 1;
    if (align === 'center') x = Math.round(x - textWidth(s) * k / 2);
    else if (align === 'right') x = x - textWidth(s) * k;
    ctx.fillStyle = color;
    for (var i = 0; i < s.length; i++) {
      var g = F[s[i]] || F['?'];
      for (var b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + (i * 4 + (b % 3)) * k, y + ((b / 3) | 0) * k, k, k);
    }
  }
  // Dither patterns for one-bit screens, as canvas patterns made on the context that uses them.
  function fill(ctx, c) {
    if (c !== 'd25' && c !== 'd75' && c !== 'd50') return c;
    var t = document.createElement('canvas'); t.width = t.height = 2;
    var x = t.getContext('2d'), ink = c === 'd75' ? '#FFFFFF' : '#000000', ground = c === 'd75' ? '#000000' : '#FFFFFF';
    x.fillStyle = ground; x.fillRect(0, 0, 2, 2); x.fillStyle = ink; x.fillRect(0, 0, 1, 1);
    if (c === 'd50') x.fillRect(1, 1, 1, 1);
    return ctx.createPattern(t, 'repeat');
  }

  /* ---- Sprite sheets: one canvas per sprite per palette, drawn once and cached. */
  var cache = {};
  function sheet(key, rows, pal, flip) {
    var k = key + '|' + pal.join() + (flip ? '|f' : '');   // palette entries are strings, so join() is a fair key
    if (cache[k]) return cache[k];
    var h = rows.length, w = rows[0].length, c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d'), inks = pal.map(function (p) { return fill(x, p); });
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var ch = rows[y][flip ? w - 1 - i : i];
      if (ch === '.') continue;
      x.fillStyle = inks[parseInt(ch, 16)]; x.fillRect(i, y, 1, 1);   // hex, so a sprite can use all 16 TV colours
    }
    return (cache[k] = c);
  }
  // Terminal fish are ASCII: drawn in the 3x5 font on a scrap of tube, so they still read on paper.
  function asciiSheet(str, pal) {
    var k = 'ascii|' + str + '|' + pal.join();
    if (cache[k]) return cache[k];
    var c = document.createElement('canvas'); c.width = textWidth(str) + 4; c.height = 9;
    var x = c.getContext('2d'); x.fillStyle = pal[3]; x.fillRect(0, 0, c.width, c.height);
    text(x, str, 2, 2, pal[0]);
    return (cache[k] = c);
  }
  // Any fish as a canvas, in a given palette (or its own machine's).
  function sprite(pond, f, pal) { pal = pal || fishPal(pond, f); return f.ascii ? asciiSheet(f.ascii, pal) : sheet(f.id, f.px, pal); }

  /* ---- Fish. Per pond: 5 commons, 1 uncommon, 1 rare, 1 night fish. All made up.
     The pocket pond is old playgrounds and childhood games; its rare is the dragon playground.
     size: length range in cm. where: the part of the pond it lives in (near or far cast, or any). */
  var FISH = {
    pocket: [
      { id: 'pk-kuti', name: 'Kuti Kuti Fry', rarity: 'common', where: 'near', size: [2, 5],
        desc: 'Clear plastic, sold by the packet. Flick it and it goes.',
        px: ['3.......3.333...', '333.....332223..', '31133..32222223.', '3111133111111313', '3111133111111213', '31123..30000023.', '3233..3.3300033.', '33.....33.333...'] },
      { id: 'pk-pebble', name: 'Five Stones Pebblefish', rarity: 'common', where: 'near', size: [4, 9],
        desc: 'Travels in fives. One is always under the sofa.',
        px: ['........3333....', '.......3222233..', '.33...322222223.', '3113.3222111233.', '3111322111112113', '3111311111122113', '3113.3001222203.', '.33..3000200203.', '.3....30000033..', '.......33333....'] },
      { id: 'pk-chapteh', name: 'Chapteh Feathertail', rarity: 'common', where: 'far', size: [10, 22],
        desc: 'Kept up by the side of a foot. Its tail never lands.',
        px: ['3...........3333....', '333.........3.33....', '32233.......332233..', '3112233....32222223.', '31111123..322221233.', '31111111331112212113', '31111111301112212113', '31111113.3300222203.', '3111233..3.30220203.', '32223.....3.333333..', '3233.......3........', '33..................'] },
      { id: 'pk-ribbon', name: 'Rubber Band Ribbonfish', rarity: 'common', where: 'any', size: [20, 45],
        desc: 'Knotted from a hundred rubber bands. Jump it at ankle height first.',
        px: ['.......3..3333.........333....', '3......333.322333333333223....', '3333....323222222222222222333.', '311133332211121112111211213123', '311113331211121112111211211113', '31333...333002000200020020333.', '33.........333333333333333....', '..............................'] },
      { id: 'pk-melon', name: 'Watermelon Puffer', rarity: 'common', where: 'far', size: [12, 25],
        desc: 'Round and striped. There is a slide inside.',
        px: ['...........333.3....', '..........322233....', '.........32222223...', '.33.....3222222223..', '3223...322211222223.', '31113.3212111211233.', '31111321121112112113', '31111311121112112113', '31113.3012111221213.', '3223...302012200203.', '.33.....3200020023..', '.......3.30002003...', '.......33.330333....', '........33..3.......'] },
      { id: 'pk-pelican', name: 'Pelican Gulper', rarity: 'uncommon', where: 'far', size: [20, 38],
        desc: 'Swallows the hook, the sinker, then sits there.',
        px: ['3..........3333.........', '33.........3.323333333..', '323........332222222223.', '.323.....33222222222223.', '.3113..3322211111110313.', '..3113322222222222233113', '..3113311111111111121113', '.3113..3300011122112113.', '.323.....33000200002003.', '323.....33.330000002003.', '33........33.333333333..', '3.......................'] },
      { id: 'pk-dragonet', name: 'Terrazzo Dragonet', rarity: 'rare', where: 'far', size: [25, 40],
        desc: 'Tiled head, terrazzo body, sandpit underneath. Older than the block next to it.',
        px: ['3.........333333333333......', '33........3223323...........', '323.......333..32333333.....', '3223......3.3332222222233...', '31123.....3322222222222223..', '311113..3322221111211120323.', '3111113322111111211111233113', '3111113311111121111112211113', '311113..3300011111221121003.', '311123....3300000200002003..', '31223....33.3030000000233...', '3233.......333.33333333.....', '33..........................', '3...........................'] },
      { id: 'pk-eel', name: 'Pontianak Eel', rarity: 'night', where: 'near', size: [30, 60],
        desc: 'Smells of frangipani. Do not say it looks nice.',
        px: ['........33333...................', '3...3333..32233333333333333.....', '333....333222222222222222223333.', '31133332111111111111111112131123', '31133311111111111111111112111113', '333...3333000000000000000203333.', '3.........33333333333333333.....', '................................'] }
    ],
    // TV game: old legends. Its rare is the swordfish that came at the shore.
    tv: [
      { id: 'tv-dory', name: 'Crown-Toss Dory', rarity: 'common', where: 'near', size: [8, 18],
        desc: 'A prince threw his crown in to calm a storm. This one kept it.',
        c: [12, 11, 10, 0], px: ['3..........3333.....', '33.......33222233...', '323.....3222222223..', '3223....3222222223..', '31123..322212112233.', '31113.3211112111213.', '31111311111121112113', '31111311111121112113', '31113.3011112221213.', '31123..300012110203.', '3223....3000200023..', '323....3.30020003...', '33.....33.302033....', '3.......33.333......'] },
      { id: 'tv-barb', name: 'Banana Trunk Barb', rarity: 'common', where: 'near', size: [6, 14],
        desc: 'Its family built the wall that stopped the swordfish. Still brings it up.',
        c: [9, 8, 7, 0], px: ['3.........33.333....', '333........3322233..', '3223.....3322222223.', '.31133..32221121233.', '..311133112111212113', '..311133112111212113', '.31133..30201221203.', '.323.....3302020203.', '333.....33.3332333..', '3.........3...3.....'] },
      { id: 'tv-stone', name: 'Singapore Stonefish', rarity: 'common', where: 'far', size: [14, 30],
        desc: 'Covered in writing nobody can read. Was blown up once, in 1843.',
        c: [1, 2, 3, 0], px: ['........333333..3333..', '.......3233..33322223.', '.33....33.33322222223.', '3223...32322222212113.', '3111333222111211121313', '3111111111121111122113', '3111333300011122221113', '3223....3030020002003.', '.33....333.3333002003.', '..........3....33333..'] },
      { id: 'tv-mullet', name: "Sisters' Mullet", rarity: 'common', where: 'far', size: [16, 34],
        desc: 'Always in pairs. Do not ask which one is older.',
        c: [6, 5, 4, 0], px: ['3...........33............', '333.........3233333333....', '3223......33222222222233..', '.31133..33222221111220323.', '..311133222222222222233113', '..311133111111111111121113', '.31133..33000011122102003.', '.323......33000020000233..', '333......33.3333333333....', '3..........33.............'] },
      { id: 'tv-shell', name: 'Kusu Shellback', rarity: 'common', where: 'any', size: [10, 26],
        desc: 'Turned into an island once to save two fishermen. Now quite shy.',
        c: [12, 10, 3, 0], px: ['..........33333.....', '........332222233...', '.3.....32222222223..', '.33...3222222222223.', '3113.32201101101233.', '31113210110110112113', '31113101101101102113', '3113.30001102201203.', '323...3000020000203.', '.3.....30000000023..', '........330000333...', '..........3333......'] },
      { id: 'tv-grouper', name: 'Badang Grouper', rarity: 'uncommon', where: 'far', size: [30, 60],
        desc: 'Ate what a river spirit left behind. Now throws rocks across the river.',
        c: [11, 10, 3, 0], px: ['............3333333....3......', '..........332233.32333323.....', '..........3233.332222222233...', '..3.......33.332222222222223..', '.323.......332222222222222223.', '32123.....3222222121111120323.', '311113..332211112111111223313.', '311111332111112111111211211113', '311111331111211111121111211113', '311113..300011111211221121113.', '31123....33000000012112120003.', '.323.......330000000000020003.', '..3.......33.330000000002003..', '..........3333.333000000333...', '............33....333333......', '..............................'] },
      { id: 'tv-todak', name: 'Temasek Todak', rarity: 'rare', where: 'far', size: [60, 120],
        desc: 'Came at the shore in a school, nose first. Bring banana trunks.',
        c: [6, 5, 4, 0], px: ['3..........3333333..............', '33.........33.322233............', '3233........3322222233..........', '.3223.....3322222222223.........', '.311133..322221111110323........', '..311113322222222222331133333333', '..31111331111111111121113.......', '.311123..300011112212003........', '.31233....3300002000203.........', '3223......3.3330000333..........', '333........33..3333.............', '3...............................'] },
      { id: 'tv-mud', name: 'Monkey Man Mudskipper', rarity: 'night', where: 'near', size: [8, 20],
        desc: 'Seen near the reservoir after midnight. Nobody has a clear photo.',
        c: [11, 10, 3, 0], px: ['........3.3333333.......', '........33323..32333333.', '.333....33.323322222223.', '31123...323222222220323.', '311113332111121111133113', '311113331112111111221113', '31113...303000022012113.', '.333....33.333300002003.', '..........33...33333333.', '........................'] }
    ],
    // Desktop: the estate. One bit, dithered.
    desk: [
      { id: 'dk-gar', name: 'Karang Guni Garfish', rarity: 'common', where: 'far', size: [25, 55],
        desc: 'Calls out at seven on Saturday. Pays for old newspaper by the kilo.',
        px: ['3........3......................', '333...333..3333333333...........', '.323....333222222222233.........', '.3113333211111111111231333333333', '..31133311111111111121113.......', '.3133...3300000000002333........', '323.....3.30333333333...........', '33.......333....................'] },
      { id: 'dk-pipe', name: 'Bamboo Pole Pipefish', rarity: 'common', where: 'near', size: [18, 40],
        desc: 'Hangs out of the kitchen window to dry.',
        px: ['3...............................', '333.....3333333333333333333.....', '31133333211211121112112131233333', '3113333211121112111211211113....', '323....33333330200033333333.....', '33............33333.............'] },
      { id: 'dk-rasbora', name: 'Rubbish Chute Rasbora', rarity: 'common', where: 'near', size: [3, 8],
        desc: 'Lives on the fourteenth floor. Comes down fast.',
        px: ['3.......3..3....', '333.....333233..', '.323...32222223.', '.311333111211313', '..31133111211213', '.3133..30020023.', '323...3.333033..', '33.....33..3....'] },
      { id: 'dk-blenny', name: 'Letterbox Blenny', rarity: 'common', where: 'any', size: [6, 14],
        desc: 'Stuffed with flyers. Reads none of them.',
        px: ['........3333333.......', '....3333333..32333333.', '.33.3333..33322222223.', '3113...33322222212313.', '3111333211111211121113', '3111333111121111122113', '3113...33000002222113.', '.33....3.333320002003.', '.3......33...33333333.', '......................'] },
      { id: 'dk-gourami', name: 'Void Deck Gourami', rarity: 'common', where: 'far', size: [10, 22],
        desc: 'Weddings on Saturday, funerals on Sunday. Same tables.',
        px: ['..........33..33..3.....', '..........323322333.....', '..........3222222223....', '.3.......322222222223...', '.333....32222222222223..', '3223...3222112111210323.', '31113.32221112111213313.', '311113211211121112121113', '311113111211121112121113', '31113.30021112122212113.', '31123..3020112211202003.', '.323....32000200020203..', '.33.....3200020002023...', '........320302000233....', '........323.333333......', '........3333............'] },
      { id: 'dk-sardine', name: 'Mama Shop Sardine', rarity: 'uncommon', where: 'near', size: [8, 18],
        desc: 'Sold loose, one at a time, next to the phone cards.',
        px: ['3............33333....', '333.......3332222233..', '.3133...3322222222223.', '..31133322222222222313', '..31113311111111112113', '.31233..3300000000203.', '3233....3.3030000033..', '33.......333.33333....'] },
      { id: 'dk-arowana', name: 'Feng Shui Arowana', rarity: 'rare', where: 'far', size: [45, 90],
        desc: 'Faces the door for luck. Has outlived two owners.',
        px: ['................................', '.........3.33...................', '..3....3333..3333333333.........', '.3233..33.33322222222223333.....', '311123..3322222222222222222033..', '31111133210110110110110110233233', '31111133101101101101101101201113', '311113..33000101101102201120033.', '32233.....3300000000200000333...', '.33.......3.33300000003333......', '..........333..3333333..........', '...........3333.................'] },
      { id: 'dk-snake', name: 'Seventh Month Snakehead', rarity: 'night', where: 'far', size: [30, 70],
        desc: 'Surfaces while the bins burn offerings. Leave it a plate.',
        px: ['...........333.........33333....', '......33333.33333333333233......', '.333..333.33333222333222333333..', '31123...33223331111112223303223.', '31111333111111111111111112331113', '31111331111111111111111112111113', '31113..330000011111112200200003.', '.333.....303000000002000023333..', '.........33.30333333333333......', '...........333..................'] }
    ],
    // Terminal: the sea and the outlying islands. ASCII, read straight off the screen.
    term: [
      { id: 'tm-silver', name: 'Kelong Silverside', rarity: 'common', where: 'near', size: [3, 8],
        desc: 'Gathers under the kelong lamps. Easily impressed.',
        ascii: "><>" },
      { id: 'tm-sand', name: 'Semakau Sandperch', rarity: 'common', where: 'far', size: [8, 18],
        desc: 'Lives off an island made of rubbish. Seems fine.',
        ascii: "><:::>" },
      { id: 'tm-blue', name: 'Ubin Bluespot', rarity: 'common', where: 'any', size: [6, 15],
        desc: 'Rents a bicycle, rides round the island once, returns it late.',
        ascii: "><(o)>" },
      { id: 'tm-fly', name: 'Changi Flyingfish', rarity: 'common', where: 'far', size: [15, 30],
        desc: 'Leaves at 2am, lands at 7. Never brings anything back.',
        ascii: ">~~\u00b0>" },
      { id: 'tm-bream', name: 'Bumboat Bream', rarity: 'common', where: 'near', size: [12, 28],
        desc: 'Takes people up the river. Tells the same three jokes.',
        ascii: "><[==]\u00b0>" },
      { id: 'tm-grouper', name: 'Gantry Grouper', rarity: 'uncommon', where: 'far', size: [40, 80],
        desc: 'Moves forty boxes an hour. Never looks up.',
        ascii: "><(((#)))\u00b0>" },
      { id: 'tm-ray', name: 'Hantu Ghostray', rarity: 'rare', where: 'far', size: [60, 140],
        desc: 'Seen off Pulau Hantu. Only ever on the way back.',
        ascii: "<=={\u00b0}==>~" },
      { id: 'tm-lantern', name: 'Last Ferry Lanternfish', rarity: 'night', where: 'near', size: [4, 10],
        desc: 'Lights itself. Waits at the jetty for a ferry that left hours ago.',
        ascii: "*><(((\u00b0>" }
    ]
  };

  /* ---- The angler, seen from behind on the jetty, and the float. */
  var ANGLER = ['....3333....', '...322223...', '.3333333333.', '..32222223..', '..32222223..', '...333333...', '..30000003..', '.3000000003.', '300000000003', '300033000003', '300000000003', '333333333333'];
  var FLOAT = ['.3.', '323', '303', '.3.'];
  var BITE = ['.3.', '.3.', '.3.', '...', '.3.'];   // the "!" over the float
  // The TV game's angler, side on, in the TV's 16 colours (hex indices): red cap, blue shirt, navy trousers.
  var ANGLER_TV = ['...dddd...', '..dddddd..', '...bbbb...', '...bb0b...', '...bbbb...', '....bb....', '..55555...', '.5555555..',
    '.55.555bb.', '.55.555...', '...4444...', '...44.44..', '...44.44..', '...44.44..', '..000.000.', '..........'];


  /* ---- Pet creatures, about 24x24. 1 main, 2 shade, 3 outline, 4 accent. The skeleton is worked out from the
     same grid. The egg's tiny screen has its own hand-drawn version (lcd), with the eyes left as holes. */
  var PETS = {
    fish: { pal: ['#000', '#F28C3A', '#D9682A', '#3A1E12', '#F4F1E6'],   // a koi
      px: ['............3333........', '33...........311333.....', '313........3311111133...', '31133.....311111114113..', '311113...31114111113013.', '311111333111111111141113', '311111111111114111111113', '311111111411111111114113', '311111333111111411111113', '311113...34111111111143.', '31133.....311111411113..', '313........3311111133...', '33...........333333.....', '........................'],
      lcd: ['....1111....', '1..111111...', '11111111.11.', '111111111111', '11111111111.', '1..111111...', '....1111....'] },
    cat: { pal: ['#000', '#E6B26A', '#C98E45', '#3A2A1C', '#B9773A'],   // a ginger cat
      px: ['..............3.......3.', '..............3.......3.', '...333........33.....33.', '..3113........313...313.', '..3113........311333113.', '.3113.........311111113.', '.3113.........311111113.', '.313.........3111113133.', '.313..........3111111113', '.313...3333333111111413.', '.3113334114114111111113.', '.311111411411411111133..', '..311114114114111133....', '..3111111111111113......', '...311111111111113......', '....3111111111113.......', '.....311111111313.......', '.....313113313.33.......', '.....33.33..33.33.......', '.....33.33..33.33.......'],
      lcd: ['........1..1', '........1111', '1.......1.11', '1.......1111', '.1.111111111', '.1111111111.', '..11111111..', '..11111111..', '..1.1..1.1..', '..1.1..1.1..'] },
    lion: { pal: ['#000', '#E9B04F', '#C9902F', '#3A2412', '#9C5A24'],   // a lion
      px: ['........................', '...3....................', '..343...................', '.34443.........33333....', '..343........334444433..', '..343.......34444444443.', '..313.......34444111443.', '.3113......3444411111443', '.3113......3444113113143', '.313..333334444111111143', '.31133111114444111111143', '.31111111114444111331143', '.3111111111144441111143.', '..311111111144444111443.', '..31111111111444444433..', '...31111111111143333....', '....311111111313........', '....313113313.33........', '....33.33..33.33........', '....33.33..33.33........'],
      lcd: ['.......1111..', '1.....111111.', '1....11.11.11', '.1...11111111', '.1..111111.11', '..11111111111', '..111111111..', '..111111111..', '..1.1...1.1..', '..1.1...1.1..'] },
    dragon: { pal: ['#000', '#F4F1E6', '#D9433A', '#3A1A14', '#F2B33D'],   // the playground dragon: a tiled head and a body of hoops
      px: ['.................3.......3..', '.................3.......3..', '.................33.....33..', '.................343...343..', '.................3443.3443..', '.................344434443..', '.................341121443..', '.........333....32112112143.', '........34443...31121133123.', '....33334434433311211211213.', '...3444443.34441121121121123', '..3443443...344321121121123.', '..343.343...343.31211211213.', '..33...33...33..321121121123', '..33...343.343...31211211213', '..33...3443443...34333133333', '.3443.344444443.343...333333', '.344434433333443443.........', '34444443.....34443..........', '3444333.......333...........', '3443........................', '333.........................'],
      lcd: ['...........1.1.', '.11...11...111.', '1..1.1..1.11.11', '1..1.1..1111111', '1..1.1..111111.', '1..1.1..1......', '1..1.1..1......'] },
    kraken: { pal: ['#000', '#8E5BB5', '#6E3F95', '#24142F', '#C9A3E8'],   // a kraken
      px: ['........................', '..........33333.........', '........331111133.......', '.......31111114113......', '......3114111111113.....', '......3111111111113.....', '......3111114111113.....', '.....311111111111113....', '......3111111111113.....', '......3113311133113.....', '......3113311133113.....', '.......31111111113......', '......31311111113.33....', '......33.31111313.33....', '.....313.31113.31313....', '.....313.31113.31113....', '.....33...313...313.....', '.....313.31113.31113....', '.....313.31313.31313....', '......31313.31313.313...', '......31113.31113.313...', '......31313.31313.313...', '.....313.31313.31313....', '....333...333...333.....'],
      lcd: ['...11111...', '..1111111..', '.111111111.', '.11.111.11.', '.111111111.', '..1111111..', '.1.1.1.1.1.', '1.1..1..1.1', '1.1..1..1.1', '.1..1.1..1.'] },
    phoenix: { pal: ['#000', '#F25A3A', '#F2A33A', '#3A1408', '#FFD45A'],   // a phoenix
      px: ['.............3............', '.............3............', '............33..3...3.....', '...........323..3...3.....', '...........3223..3.3......', '...........3223..333......', '..........34423.31113.....', '..........344223111343....', '.........34442211111443...', '.........3444421111143333.', '........3244442213133.....', '.......3244444423.3.......', '.......31111111113........', '.......31111111113........', '.......31111111113........', '....3332111111113.........', '..33232241111313..........', '.3233.3442233.3...........', '.33..3444223..3...........', '323.34332233..3...........', '33.343..33.3..3...........', '..343..323................', '..343.323.................', '.333.333..................'],
      lcd: ['.....1.......', '....11....1..', '...111...111.', '..1111..11.11', '..111111111..', '...111111....', '..1.11.1.....', '.1..1..1.....', '1..1.........'] }
  };
  var BONE = ['#000', '#EDE6D2', '#BFB7A3', '#5A554C'];
  var LCD = ['#B9C4A0', '#2E3A28'];   // the egg's screen: ground, ink
  // The bones: the outline turns to bone, and every third column inside becomes a rib.
  function boneRows(rows) {
    return rows.map(function (r, y) {
      return r.split('').map(function (ch, x) { return ch === '3' ? '1' : ch === '.' ? '.' : (x % 3 === 0 && y > 1 && y < rows.length - 2 ? '2' : '.'); }).join('');
    });
  }
  // The LCD version: half size, a pixel inked where at least two of the four underneath are drawn.
  // At 12 px this is a silhouette, as small screens like this one show them.
  function lcdRows(rows) {
    var out = [];
    for (var y = 0; y < rows.length; y += 2) {
      var line = '';
      for (var x = 0; x < rows[0].length; x += 2) {
        var n = 0;
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (o) { var r = rows[y + o[1]]; if (r && r[x + o[0]] && r[x + o[0]] !== '.') n++; });
        line += n >= 2 ? '1' : '.';
      }
      out.push(line);
    }
    return out;
  }
  // mode: 'live' (its colours), 'bone' (a skeleton), 'lcd' (two-tone, half size). flip: facing left.
  function pet(kind, mode, flip) {
    var P = PETS[kind];
    if (mode === 'bone') return sheet('bone-' + kind, boneRows(P.px), BONE, flip);
    if (mode === 'lcd') return sheet('lcd-' + kind, P.lcd || lcdRows(P.px), [LCD[0], LCD[1]], flip);   // drawn by hand for the tiny screen
    return sheet('pet-' + kind, P.px, P.pal, flip);
  }
  var EGG = ['..1111..', '.1....1.', '1......1', '1......1', '1......1', '1......1', '.1....1.', '..1111..'];
  var EGG_CRACK = ['..1111..', '.1....1.', '1......1', '1.1.1..1', '11.1.111', '1......1', '.1....1.', '..1111..'];

  window.drunkwizArt = { PAL: PAL, FISH: FISH, ANGLER: ANGLER, ANGLER_TV: ANGLER_TV, FLOAT: FLOAT, BITE: BITE, sheet: sheet, sprite: sprite, PETS: PETS, pet: pet, LCD: LCD, EGG: EGG, EGG_CRACK: EGG_CRACK, fishPal: fishPal, fill: fill, text: text, textWidth: textWidth };
})();
