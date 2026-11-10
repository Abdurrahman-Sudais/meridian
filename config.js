/* =====================================================================
   MERIDIAN — vintage watches & eyewear
   Edit the catalogue below. Each piece can carry vintage details:
     year, ref (reference no.), condition ('Excellent' | 'Very good' | 'Good'),
     movement / case (watches) or measurements (eyewear), and `options`
     (e.g. lens choices) which replaces the size picker for that piece.
   ===================================================================== */
const STORE_TYPE = 'vintage';
const U = (id, w = 800) => /^https?:/.test(id) ? id : `https://images.unsplash.com/${id}?w=${w}&q=80`;

const LENSES = ['Original lenses', 'Prescription', 'Blue-light'];

const PRESETS = {
  vintage: {
    label: 'Vintage watches, eyewear & accessories',
    unit: 'pieces',
    sizes: null,
    tagline: 'Pre-owned watches and eyewear, 1940–1990. Authenticated, serviced, guaranteed.',
    eyebrow: 'Est. 1962 · Geneva &amp; London',
    heroTitle: 'Time, worn<br><em>beautifully.</em>',
    heroSub: 'Hand-picked vintage timepieces and eyewear, each one authenticated, serviced by our watchmakers and sold with its story.',
    heroImg: U('photo-1547996160-81dfa63595aa', 2000),
    marquee: ['Authenticated','Serviced in-house','24-month warranty','One of one','Since 1962'],
    catSub: 'Watches, eyewear and the accessories that keep them company.',
    dropName: 'The 1968 Archive', dropSub: 'Eleven chronographs from one private collection. Released together, once.',
    dropImg: U('photo-1508685096489-7aacd43bd3b1', 1800),
    lookbook: ['photo-1522312346375-d1a52e2b99b3','photo-1577803645773-f96470509666','photo-1587836374828-4dbafa94cf0e','photo-1574258495973-f010dfbb5371','photo-1614164185128-e4ec99c436d7'],
    categories: [
      { key:'dress', label:'Dress watches', img:'photo-1524592094714-0f0654e20314' },
      { key:'chrono', label:'Chronographs', img:'photo-1508685096489-7aacd43bd3b1' },
      { key:'sun', label:'Sunglasses', img:'photo-1511499767150-a48a237f0083' },
      { key:'optical', label:'Optical frames', img:'photo-1574258495973-f010dfbb5371' },
      { key:'pens', label:'Writing instruments', img:'photo-1585336261022-680e295ce3fe' },
      { key:'leather', label:'Straps & leather', img:'photo-1627123424574-724758594e93' },
      { key:'jewelry', label:'Cufflinks & rings', img:'photo-1605100804763-247f67b3557e' },
      { key:'desk', label:'Clocks & desk', img:'photo-1563861826100-9cb868fdbe1c' },
    ],
    products: [
      { id:1, name:'Calatrava-style Dress Watch', cat:'dress', price:4850, rating:5, reviews:12, year:1958, ref:'Ref. 2526', condition:'Excellent', movement:'Manual wind, cal. 12-400', case:'34mm 18k yellow gold', colors:['#d4af37'], imgs:['photo-1524592094714-0f0654e20314','photo-1523275335684-37898b6baf30'], stock:1, isNew:true },
      { id:2, name:'Racing Chronograph', cat:'chrono', price:7200, rating:5, reviews:8, year:1968, ref:'Ref. 6239', condition:'Very good', movement:'Manual chronograph, cal. 72B', case:'37mm stainless steel', colors:['#c0c0c0','#111'], imgs:['photo-1508685096489-7aacd43bd3b1','photo-1587836374828-4dbafa94cf0e'], stock:1 },
      { id:3, name:'Aviator Sunglasses', cat:'sun', price:420, rating:4.9, reviews:31, year:1974, ref:'Gold-filled, 58□14', condition:'Excellent', measurements:'58mm lens · 14mm bridge · 140mm temple', colors:['#d4af37','#3b3a2e'], imgs:['photo-1511499767150-a48a237f0083','photo-1572635196237-14b3f281503f'], options:LENSES, stock:2 },
      { id:4, name:'Tortoiseshell Round Frames', cat:'optical', price:360, rating:4.8, reviews:22, year:1952, ref:'Acetate P3, 46□22', condition:'Very good', measurements:'46mm lens · 22mm bridge · 145mm temple', colors:['#6b4a2b'], imgs:['photo-1574258495973-f010dfbb5371','photo-1591076482161-42ce6da69f67'], options:LENSES, stock:1 },
      { id:5, name:'Diver, Tropical Dial', cat:'chrono', price:9800, was:10900, rating:5, reviews:6, year:1971, ref:'Ref. 5513', condition:'Good', movement:'Automatic, cal. 1520', case:'40mm steel, bezel insert faded', colors:['#111','#5a3b26'], imgs:['photo-1587836374828-4dbafa94cf0e','photo-1522312346375-d1a52e2b99b3'], stock:1, isNew:true },
      { id:6, name:'Cat-Eye Sunglasses', cat:'sun', price:290, rating:4.7, reviews:40, year:1961, ref:'Acetate, 50□20', condition:'Excellent', measurements:'50mm lens · 20mm bridge · 135mm temple', colors:['#111','#8b2c2c'], imgs:['photo-1577803645773-f96470509666','photo-1473496169904-658ba7c44d8a'], options:LENSES, stock:3 },
      { id:7, name:'Tank-style Rectangular', cat:'dress', price:3600, rating:4.9, reviews:15, year:1979, ref:'Ref. 7808', condition:'Very good', movement:'Manual wind, cal. 78', case:'23×30mm 18k gold-plated', colors:['#d4af37'], imgs:['photo-1614164185128-e4ec99c436d7','photo-1524592094714-0f0654e20314'], stock:1 },
      { id:8, name:'Browline Optical Frames', cat:'optical', price:310, was:380, rating:4.8, reviews:18, year:1958, ref:'Acetate & metal, 49□20', condition:'Good', measurements:'49mm lens · 20mm bridge · 145mm temple', colors:['#111','#6b4a2b'], imgs:['photo-1591076482161-42ce6da69f67','photo-1508296695146-257a814070b4'], options:LENSES, stock:2 },
      { id:9, name:'Moonphase Calendar', cat:'dress', price:6400, rating:5, reviews:4, year:1949, ref:'Ref. 1415', condition:'Very good', movement:'Manual wind, triple calendar', case:'35mm 18k rose gold', colors:['#c99a7c'], imgs:['photo-1523275335684-37898b6baf30','photo-1547996160-81dfa63595aa'], stock:1 },
      { id:10, name:'Panto Sunglasses', cat:'sun', price:340, rating:4.6, reviews:27, year:1983, ref:'Titanium, 47□22', condition:'Excellent', measurements:'47mm lens · 22mm bridge · 145mm temple', colors:['#c0c0c0','#2f3a2a'], imgs:['photo-1473496169904-658ba7c44d8a','photo-1511499767150-a48a237f0083'], options:LENSES, stock:2 },
      { id:11, name:'Lacquer Fountain Pen', cat:'pens', price:680, rating:4.9, reviews:19, year:1938, ref:'14k gold nib, lever fill', condition:'Very good', measurements:'Medium nib · 13.2cm capped', colors:['#111','#8b2c2c'], imgs:['photo-1585336261022-680e295ce3fe','photo-1455390582262-044cdead277a'], options:['Fine nib','Medium nib','Broad nib'], stock:1, isNew:true },
      { id:12, name:'Engine-turned Ballpoint', cat:'pens', price:240, rating:4.7, reviews:33, year:1965, ref:'Sterling silver', condition:'Excellent', measurements:'13.5cm · 28g', colors:['#c0c0c0'], imgs:['photo-1455390582262-044cdead277a','photo-1585336261022-680e295ce3fe'], stock:2 },
      { id:13, name:'Cordovan Watch Strap', cat:'leather', price:180, rating:4.8, reviews:64, year:2026, ref:'Hand-stitched, new old stock buckle', condition:'New', measurements:'18 / 20 / 22mm lug widths', colors:['#5a3b26','#111'], imgs:['photo-1627123424574-724758594e93','photo-1606503825008-909a67e63c3d'], options:['18mm','20mm','22mm'], stock:6 },
      { id:14, name:'Three-Watch Travel Roll', cat:'leather', price:260, rating:4.9, reviews:21, year:2026, ref:'Bridle leather, suede lined', condition:'New', measurements:'Holds 3 watches up to 44mm', colors:['#5a3b26','#2f3a2a'], imgs:['photo-1606503825008-909a67e63c3d','photo-1627123424574-724758594e93'], stock:4 },
      { id:15, name:'Onyx Signet Ring', cat:'jewelry', price:890, rating:5, reviews:9, year:1955, ref:'18k gold, black onyx', condition:'Very good', measurements:'UK size R · resizable', colors:['#d4af37','#111'], imgs:['photo-1605100804763-247f67b3557e','photo-1611591437281-460bfbe1220a'], stock:1 },
      { id:16, name:'Guilloché Cufflinks', cat:'jewelry', price:420, was:480, rating:4.8, reviews:14, year:1962, ref:'Sterling silver &amp; enamel', condition:'Excellent', measurements:'16mm faces · original box', colors:['#1d3557','#c0c0c0'], imgs:['photo-1611591437281-460bfbe1220a','photo-1605100804763-247f67b3557e'], stock:1 },
      { id:17, name:'Brass Carriage Clock', cat:'desk', price:1250, rating:4.9, reviews:11, year:1910, ref:'8-day movement, bevelled glass', condition:'Very good', movement:'8-day mechanical, serviced', case:'Brass, 14cm tall', colors:['#c9a45c'], imgs:['photo-1563861826100-9cb868fdbe1c','photo-1501139083538-0139583c060f'], stock:1 },
    ],
  },
};

const STORE_KEY = 'vintage';
const STORE = PRESETS[STORE_KEY];
