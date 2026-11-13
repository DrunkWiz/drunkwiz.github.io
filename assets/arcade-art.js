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
  function fishPal(pond, f) { return pond === 'tv' ? f.c.map(function (i) { return PAL.tv[i]; }) : PAL[pond]; }

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
    '@': '010101111100011', '\u2591': '101010101010101', '\u2588': '111111111111111'
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
    ],
    // TV game: old legends. Its rare is the swordfish that came at the shore.
    tv: [
      { id: 'tv-dory', name: 'Crown-Toss Dory', rarity: 'common', where: 'near', size: [8, 18],
        desc: 'A prince threw his crown in to calm a storm. This one kept it.',
        c: [12, 11, 10, 0], px: ['...........333......', '33......333222333...', '313....31112221113..', '3113..3111122213013.', '31113311111222111113', '31111111111222111113', '31111111111222111113', '31113311111222111113', '3113..3111122211113.', '313....31112221113..', '33......333222333...', '...........333......'] },
      { id: 'tv-barb', name: 'Banana Trunk Barb', rarity: 'common', where: 'near', size: [6, 14],
        desc: 'Its family built the wall that stopped the swordfish. Still brings it up.',
        c: [9, 8, 7, 0], px: ['..........333.......', '333......31213333...', '.3333..331121112333.', '....3332111211121113', '....3332111211121113', '.3333..331121112133.', '333......33333333...', '....................'] },
      { id: 'tv-stone', name: 'Singapore Stonefish', rarity: 'common', where: 'far', size: [14, 30],
        desc: 'Covered in writing nobody can read. Was blown up once, in 1843.',
        c: [1, 2, 3, 0], px: ['........3333........', '.3......3111333333..', '313...3311112111113.', '3113.312111111130123', '31113111111112111113', '31113111211111111113', '3113.311111111211113', '313...3312111111113.', '.3......3333333333..', '....................'] },
      { id: 'tv-mullet', name: "Sisters' Mullet", rarity: 'common', where: 'far', size: [16, 34],
        desc: 'Always in pairs. Do not ask which one is older.',
        c: [6, 5, 4, 0], px: ['...........3333.........', '333......332222333333...', '.3333..3322222222223033.', '....33311111111111111113', '....33311111111111111113', '.3333..3300000000000033.', '333......333333333333...', '........................'] },
      { id: 'tv-shell', name: 'Kusu Shellback', rarity: 'common', where: 'any', size: [10, 26],
        desc: 'Turned into an island once to save two fishermen. Now quite shy.',
        c: [12, 10, 3, 0], px: ['.........333333.....', '.......3311111133...', '33....311111211113..', '313..31211111113013.', '31133111111112111113', '31111111211111111113', '31111111111111211113', '31133111121111111113', '313..31111111112113.', '33....311121111113..', '.......3311111133...', '.........333333.....'] },
      { id: 'tv-grouper', name: 'Badang Grouper', rarity: 'uncommon', where: 'far', size: [30, 60],
        desc: 'Ate what a river spirit left behind. Now throws rocks across the river.',
        c: [11, 10, 3, 0], px: ['.............33333..........', '............311112333333....', '..3.......3321111111111233..', '3313.....311111111211111113.', '311133..3111121111111130213.', '3111113321111111111211111113', '3111111111111121111111111213', '3111111112111111111121111113', '3111113311111112111111111123', '311133..3121111111111211113.', '3313.....311111121111111113.', '..3.......3311111111112133..', '............333333333333....', '............................'] },
      { id: 'tv-todak', name: 'Temasek Todak', rarity: 'rare', where: 'far', size: [60, 120],
        desc: 'Came at the shore in a school, nose first. Bring banana trunks.',
        c: [6, 5, 4, 0], px: ['............3333................', '33..........32223333............', '3333.....33322222222333.........', '...333..3222222222223023........', '....3133111111111111111133333333', '....313311111111111111113.......', '...333..3000000000000003........', '3333.....33300000000333.........', '33..........33333333............', '................................'] },
      { id: 'tv-mud', name: 'Monkey Man Mudskipper', rarity: 'night', where: 'near', size: [8, 20],
        desc: 'Seen near the reservoir after midnight. Nobody has a clear photo.',
        c: [11, 10, 3, 0], px: ['..................333...', '...........333333311133.', '3333....333121111111113.', '311133.31111111111230113', '311111311111121111111113', '311111312111111111121113', '311133.31111112111111113', '3333....333111111111213.', '...........333333311133.', '..................333...'] }
    ],
    // Desktop: the estate. One bit, dithered.
    desk: [
      { id: 'dk-gar', name: 'Karang Guni Garfish', rarity: 'common', where: 'far', size: [25, 55],
        desc: 'Calls out at seven on Saturday. Pays for old newspaper by the kilo.',
        px: ['...........33333................', '33.......3322222333333..........', '.333..3332222222222230333.......', '...33311111111111111111113333333', '...33311111111111111111113......', '.333..3331111111111111333.......', '33.......3333333333333..........', '................................'] },
      { id: 'dk-pipe', name: 'Bamboo Pole Pipefish', rarity: 'common', where: 'near', size: [18, 40],
        desc: 'Hangs out of the kitchen window to dry.',
        px: ['................................', '........3333333333333333333.....', '33...3333000300030003000300333..', '30333000300030003000300030000033', '30333000300030003000300030000033', '33...3333000300030003000300333..', '........3333333333333333333.....', '................................'] },
      { id: 'dk-rasbora', name: 'Rubbish Chute Rasbora', rarity: 'common', where: 'near', size: [3, 8],
        desc: 'Lives on the fourteenth floor. Comes down fast.',
        px: ['........33......', '33.....3023333..', '.333..300222303.', '...3330002220003', '...3330002220003', '.333..300222003.', '33.....3333333..', '................'] },
      { id: 'dk-blenny', name: 'Letterbox Blenny', rarity: 'common', where: 'any', size: [6, 14],
        desc: 'Stuffed with flyers. Reads none of them.',
        px: ['...............33...', '.3.......3333331133.', '313....3311131111113', '31133.33111111130133', '31111311111113111113', '31111311311111111113', '31133.31111111311113', '313....3331111111113', '.3.......3333333133.', '...............33...'] },
      { id: 'dk-gourami', name: 'Void Deck Gourami', rarity: 'common', where: 'far', size: [10, 22],
        desc: 'Weddings on Saturday, funerals on Sunday. Same tables.',
        px: ['..............333.......', '33.........333001333....', '303......3301000100033..', '3303....300010001000003.', '..3333..300010001003003.', '....30331000100010000003', '....30001000100010000003', '....30001000100010000003', '....30331000100010000003', '..3333..300010001000003.', '3303....300010001000003.', '303......3301000100033..', '33.........333001333....', '..............333.......'] },
      { id: 'dk-sardine', name: 'Mama Shop Sardine', rarity: 'uncommon', where: 'near', size: [8, 18],
        desc: 'Sold loose, one at a time, next to the phone cards.',
        px: ['..........333.......', '333......32223333...', '.3333..332222222333.', '....3330000000000003', '....3330000000000003', '.3333..330000000033.', '333......33333333...', '....................'] },
      { id: 'dk-arowana', name: 'Feng Shui Arowana', rarity: 'rare', where: 'far', size: [45, 90],
        desc: 'Faces the door for luck. Has outlived two owners.',
        px: ['..............333333............', '...............3100033..........', '3.33.......333301000103333......', '33003....33010001000100010333...', '3000033.30001000100010001300033.', '30000003100010001000100010000003', '30000003100010001000100010000003', '3000033.31111111111111111111133.', '33003....33111111111111111333...', '3.33.......333311111113333......', '...............3333333..........', '................................'] },
      { id: 'dk-snake', name: 'Seventh Month Snakehead', rarity: 'night', where: 'far', size: [30, 70],
        desc: 'Surfaces while the bins burn offerings. Leave it a plate.',
        px: ['.............3333333............', '.............322232233333.......', '3333.....33332222222222323333...', '322233.332222222223222223022233.', '32222232222223222222222232222223', '32222232322222222223222222222233', '322233.332222232222222222322233.', '3333.....33332222222322223333...', '.............333333333333.......', '................................'] }
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
