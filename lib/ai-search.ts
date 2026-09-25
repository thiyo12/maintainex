interface SubService {
  id: string
  name: string
  keywords: string[]
}

interface CategoryDef {
  id: string
  name: string
  icon: string
  colorHex: string
  keywords: string[]
  subServices: SubService[]
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - lev(a, b) / maxLen
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF\u0D80-\u0DFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTamil(text: string): boolean { return /[\u0B80-\u0BFF]/.test(text) }
function isSinhala(text: string): boolean { return /[\u0D80-\u0DFF]/.test(text) }

const CATEGORIES: CategoryDef[] = [
  {
    id: 'electrical-works', name: 'Electrical Works', icon: 'flash', colorHex: '#F59E0B',
    keywords: [
      'electrical', 'electric', 'electrician', 'elec', 'electrik', 'elactrical', 'electrikan',
      'wiring', 'wire', 'wirring', 'circuit', 'breaker', 'fuse', 'switch', 'socket', 'plug',
      'light', 'lighting', 'lamp', 'bulb', 'tube light', 'led', 'fan', 'ceiling fan', 'exhaust fan',
      'power', 'voltage', 'current', 'generator', 'inverter', 'stabilizer',
      'doorbell', 'extension board', 'water heater', 'power outage', 'garden lighting',
      'my fan not working', 'light not working', 'power cut', 'no electricity', 'spark', 'sparking',
      'short circuit', 'trip', 'tripping', 'board', 'electric board',
      'விசிறி', 'லைட்', 'மின்', 'மின்சார', 'வயரிங்', 'கம்பி', 'சர்க்யூட்', 'சுவிட்ச்', 'சாக்கெட்', 'ஃபியூஸ்', 'கரண்ட்', 'மின் வேலை',
      'විදුලි', 'විදුලි කාර්මික', 'වයර්', 'වයරින්', 'ෆියුස්', 'පරිපථ', 'ස්විච්', 'සොකට්', 'බලය', 'කරන්ට්', 'වොට්', 'මින්', 'මින් වැලැයි',
    ],
    subServices: [
      { id: 'wiring', name: 'Wiring and rewiring', keywords: ['wiring', 'rewiring', 'wire', 'cable', 'circuit', 'panel', 'distribution', 'switchboard'] },
      { id: 'switch-socket', name: 'Switch and socket installation', keywords: ['switch', 'socket', 'outlet', 'plug', 'power point'] },
      { id: 'breaker', name: 'Circuit breaker repair', keywords: ['breaker', 'circuit breaker', 'tripping', 'trip', 'fuse box'] },
      { id: 'fan-light', name: 'Light and fan installation', keywords: ['fan', 'light', 'ceiling fan', 'exhaust fan', 'bulb', 'lamp', 'led', 'tube light', 'fixture'] },
      { id: 'doorbell', name: 'Doorbell installation', keywords: ['doorbell', 'bell', 'chime', 'video doorbell'] },
      { id: 'extension', name: 'Extension board and cabling', keywords: ['extension', 'board', 'power strip', 'cable', 'cabling'] },
      { id: 'generator', name: 'Generator connection', keywords: ['generator', 'backup', 'power backup', 'changeover'] },
      { id: 'inverter', name: 'Inverter and solar wiring', keywords: ['inverter', 'solar', 'battery', 'backup power'] },
      { id: 'water-heater', name: 'Water heater installation', keywords: ['water heater', 'geyser', 'hot water', 'heater'] },
      { id: 'power-outage', name: 'Power outage repair', keywords: ['power outage', 'no power', 'power cut', 'blackout', 'no electricity'] },
      { id: 'garden-light', name: 'Garden lighting installation', keywords: ['garden light', 'outdoor light', 'pathway light', 'landscape light'] },
      { id: 'emergency-elec', name: 'Emergency electrical repair', keywords: ['emergency', 'sparking', 'exposed wire', 'spark', 'electrical emergency'] },
    ],
  },
  {
    id: 'plumbing', name: 'Plumbing', icon: 'water', colorHex: '#3B82F6',
    keywords: [
      'plumbing', 'plumber', 'plumb', 'plomber', 'plumbir',
      'pipe', 'pipes', 'piping', 'tap', 'taps', 'faucet', 'leak', 'leaking', 'leakage',
      'drain', 'drainage', 'clogged', 'blocked', 'blockage',
      'toilet', 'flush', 'sink', 'basin', 'shower', 'bathroom',
      'water', 'water tank', 'overhead tank', 'pump',
      'sewer', 'sewage', 'kitchen sink', 'hot water',
      'water is leaking', 'tap not working', 'toilet not flushing', 'drain blocked',
      'குழாய்', 'பைப்', 'தண்ணீர்', 'கசிவு', 'வடிகால்', 'குளியலறை', 'கழிப்பறை', 'திறப்பு', 'சாக்கடை', 'குழாய் கசிவு',
      'නල', 'ජලනල', 'කානු', 'කාන්දු', 'වතුර', 'ජලය', 'බේසම', 'වැසිකිළි', 'නාන කාමර', 'පයිප්', 'පයිප්ප', 'පිටාර',
    ],
    subServices: [
      { id: 'leak-pipe', name: 'Leaking pipe repair', keywords: ['leak', 'leaking', 'pipe', 'leakage', 'burst pipe', 'water leak'] },
      { id: 'tap-faucet', name: 'Tap and faucet repair', keywords: ['tap', 'faucet', 'dripping', 'tap repair', 'tap fix'] },
      { id: 'toilet', name: 'Toilet flush repair', keywords: ['toilet', 'flush', 'running toilet', 'toilet repair'] },
      { id: 'water-tank', name: 'Water tank installation', keywords: ['tank', 'water tank', 'overhead tank', 'tank installation'] },
      { id: 'pump', name: 'Water pump repair', keywords: ['pump', 'water pump', 'pressure', 'motor'] },
      { id: 'drain', name: 'Drain unblocking', keywords: ['drain', 'blocked', 'clogged', 'unblock', 'blockage'] },
      { id: 'shower', name: 'Shower fitting installation', keywords: ['shower', 'shower head', 'shower fitting', 'bathroom fitting'] },
      { id: 'hot-water', name: 'Hot water system repair', keywords: ['hot water', 'geyser', 'water heater', 'heater repair'] },
      { id: 'kitchen-sink', name: 'Kitchen sink installation', keywords: ['kitchen sink', 'sink', 'sink installation'] },
      { id: 'sewage', name: 'Sewage pipe repair', keywords: ['sewage', 'sewer', 'drainage pipe', 'sewage pipe'] },
      { id: 'emergency-plumb', name: 'Emergency plumbing repair', keywords: ['emergency', 'burst pipe', 'flood', 'plumbing emergency'] },
    ],
  },
  {
    id: 'ac-and-refrigeration', name: 'AC and Refrigeration', icon: 'snowflake', colorHex: '#06B6D4',
    keywords: [
      'ac', 'aircon', 'air condition', 'air conditioning', 'a/c', 'air conditioner',
      'ac service', 'ac repair', 'ac install', 'ac installation', 'ac gas', 'gas refill',
      'ac clean', 'ac cleaning', 'ac maintenance', 'split ac', 'window ac', 'central ac',
      'cooler', 'air cooler', 'refrigerator', 'fridge', 'freezer', 'cold room',
      'ventilation', 'exhaust fan', 'cooling', 'not cooling',
      'ac not working', 'ac not cooling', 'fridge not working', 'freezer not working',
      'ஏசி', 'ஏசி சர்வீஸ்', 'குளிர்சாதனம்', 'குளிர்பதன பெட்டி',
      'ඒසී', 'ඒසී සර්විස්', 'ඒසී ෆික්ස්', 'ශීතකරණය', 'ෆ්‍රීජ්',
    ],
    subServices: [
      { id: 'ac-install', name: 'AC installation', keywords: ['ac install', 'install ac', 'ac installation', 'split ac install'] },
      { id: 'ac-service', name: 'AC servicing and cleaning', keywords: ['ac service', 'ac clean', 'ac maintenance', 'servicing'] },
      { id: 'ac-gas', name: 'AC gas refilling', keywords: ['ac gas', 'gas refill', 'gas fill', 'refrigerant'] },
      { id: 'ac-not-cooling', name: 'AC not cooling repair', keywords: ['ac not cooling', 'not cooling', 'ac repair', 'cooling problem'] },
      { id: 'ac-leak', name: 'AC water leak repair', keywords: ['ac leak', 'water leak', 'ac water', 'dripping ac'] },
      { id: 'ac-remote', name: 'AC remote repair', keywords: ['ac remote', 'remote control', 'remote repair'] },
      { id: 'fridge', name: 'Refrigerator repair', keywords: ['fridge', 'refrigerator', 'fridge repair', 'fridge not cooling'] },
      { id: 'freezer', name: 'Freezer repair', keywords: ['freezer', 'freezer repair', 'freezer not working'] },
      { id: 'cold-room', name: 'Cold room maintenance', keywords: ['cold room', 'cold storage', 'commercial cooling'] },
      { id: 'ventilation', name: 'Ventilation fan installation', keywords: ['ventilation', 'exhaust fan', 'ventilation fan', 'air flow'] },
    ],
  },
  {
    id: 'painting-and-decorating', name: 'Painting and Decorating', icon: 'color-palette', colorHex: '#EC4899',
    keywords: [
      'painting', 'paint', 'painter', 'paintir', 'pencel', 'pinting',
      'wall paint', 'ceiling paint', 'interior paint', 'exterior paint',
      'color', 'colour', 'colouring', 'coloring',
      'waterproof', 'waterproofing', 'texture', 'texture paint',
      'whitewash', 'white wash', 'emulsion', 'primer',
      'brush', 'roller', 'spray paint', 'paint removal',
      'wall', 'ceiling', 'coating', 'varnish', 'decor',
      'wall needs painting', 'paint my house', 'repaint',
      'வர்ணம்', 'பெயின்ட்', 'சாயம்', 'சுவர்', 'நிறம்', 'பூச்சு', 'தூரிகை', 'வர்ணம் அடி',
      'තීන්ත', 'පාට', 'බිත්ති', 'වර්ණ', 'ආලේපන', 'බුරුසු', 'රෝලර්', 'තබා', 'පෙන්', 'කලර්', 'තබා කරන්න',
    ],
    subServices: [
      { id: 'interior-paint', name: 'Interior wall painting', keywords: ['interior', 'wall paint', 'inside', 'room paint', 'wall painting'] },
      { id: 'exterior-paint', name: 'Exterior house painting', keywords: ['exterior', 'outside', 'house paint', 'facade', 'external'] },
      { id: 'ceiling-paint', name: 'Ceiling painting', keywords: ['ceiling', 'ceiling paint', 'roof paint', 'overhead'] },
      { id: 'wallpaper', name: 'Wallpaper installation', keywords: ['wallpaper', 'wall paper', 'wall covering', 'wall sticker'] },
      { id: 'furniture-paint', name: 'Furniture painting and refinishing', keywords: ['furniture paint', 'refinish', 'stain', 'furniture'] },
      { id: 'texture', name: 'Texture wall finish', keywords: ['texture', 'texture paint', 'decorative', 'designer wall'] },
      { id: 'door-trim', name: 'Door and trim painting', keywords: ['door', 'trim', 'molding', 'baseboard', 'door paint'] },
      { id: 'waterproof-coat', name: 'Waterproof coating application', keywords: ['waterproof', 'waterproofing', 'coating', 'seal'] },
      { id: 'metal-paint', name: 'Metal railing painting', keywords: ['metal', 'railing', 'gate', 'grill', 'fence paint'] },
    ],
  },
  {
    id: 'carpentry-and-furniture', name: 'Carpentry and Furniture', icon: 'hammer', colorHex: '#92400E',
    keywords: [
      'carpentry', 'carpenter', 'wood', 'timber', 'furniture', 'cabinet',
      'door', 'window', 'frame', 'woodwork', 'wooden',
      'shelf', 'shelves', 'wardrobe', 'cupboard', 'desk', 'table', 'chair', 'bed',
      'assembly', 'assemble', 'furniture assembly', 'flat pack', 'ikea',
      'custom', 'built-in', 'install', 'repair', 'fix',
      'shelf install', 'cabinet repair', 'door repair', 'window repair',
      'மரம்', 'தளபாடங்கள்', 'அலமாரி', 'கதவு', 'சட்டம்', 'ஜோடிக்க', 'கூட்டு',
      'ගස්', 'ගෘහ භාණ්ඩ', 'අල්මාරිය', 'දොර', 'ජනේලය', 'එකලස්', 'සාදන්න', 'ඉදිකරන්න', 'ස්ථාපනය', 'සකස්',
    ],
    subServices: [
      { id: 'shelf', name: 'Custom shelf installation', keywords: ['shelf', 'shelves', 'bookcase', 'rack', 'storage'] },
      { id: 'cabinet', name: 'Cabinet repair and refacing', keywords: ['cabinet', 'cupboard', 'kitchen cabinet', 'cabinet repair'] },
      { id: 'door', name: 'Door repair and hanging', keywords: ['door', 'door repair', 'door hinge', 'door hanging', 'door fix'] },
      { id: 'furniture-assembly', name: 'Furniture assembly', keywords: ['assembly', 'assemble', 'furniture', 'ikea', 'flat pack', 'put together'] },
      { id: 'floor-wood', name: 'Wooden floor installation', keywords: ['wooden floor', 'hardwood', 'laminate', 'flooring', 'wood floor'] },
      { id: 'deck', name: 'Deck and porch building', keywords: ['deck', 'porch', 'patio', 'outdoor', 'balcony'] },
      { id: 'window-frame', name: 'Window and door frame repair', keywords: ['window frame', 'door frame', 'frame repair', 'sill'] },
      { id: 'wardrobe', name: 'Custom wardrobe build', keywords: ['wardrobe', 'closet', 'built-in', 'custom storage'] },
      { id: 'staircase', name: 'Staircase railing installation', keywords: ['staircase', 'railing', 'handrail', 'stair', 'baluster'] },
    ],
  },
  {
    id: 'tiling-and-flooring', name: 'Tiling and Flooring', icon: 'grid', colorHex: '#7C3AED',
    keywords: [
      'tiling', 'tile', 'tiles', 'flooring', 'floor', 'floor tile', 'wall tile',
      'ceramic', 'porcelain', 'vitrified', 'mosaic', 'grout', 'adhesive',
      'carpet', 'vinyl', 'skirting', 'baseboard',
      'tile repair', 'tile installation', 'tile replace', 'floor install',
      'bathroom tile', 'kitchen tile', 'patio tile',
      'ஓடு', 'தரை', 'தளம்', 'கர்ராம்', 'கான்கிரீட் ஓடு',
      'ටයිල්', 'බිම් පවුම්', 'කාමර බිම', 'බිම ප්‍රතිසංස්කරණ',
    ],
    subServices: [
      { id: 'floor-tile', name: 'Floor tile installation', keywords: ['floor tile', 'flooring', 'tile install', 'floor install'] },
      { id: 'wall-tile', name: 'Wall tile installation', keywords: ['wall tile', 'bathroom tile', 'kitchen tile', 'wall tiling'] },
      { id: 'tile-repair', name: 'Tile repair and replacement', keywords: ['tile repair', 'broken tile', 'replace tile', 'crack tile'] },
      { id: 'waterproof-tile', name: 'Bathroom waterproofing', keywords: ['waterproof', 'waterproofing', 'bathroom waterproof', 'membrane'] },
      { id: 'vinyl', name: 'Vinyl flooring installation', keywords: ['vinyl', 'vinyl floor', 'vinyl plank', 'luxury vinyl'] },
      { id: 'mosaic', name: 'Mosaic tile work', keywords: ['mosaic', 'decorative tile', 'pattern', 'design tile'] },
      { id: 'carpet', name: 'Carpet installation', keywords: ['carpet', 'carpet install', 'rug', 'underlay'] },
      { id: 'skirting', name: 'Skirting board installation', keywords: ['skirting', 'baseboard', 'molding', 'trim'] },
      { id: 'patio-tile', name: 'Outdoor patio tiling', keywords: ['patio', 'outdoor', 'balcony', 'terrace', 'outdoor tile'] },
    ],
  },
  {
    id: 'masonry-and-concrete', name: 'Masonry and Concrete', icon: 'construct', colorHex: '#78716C',
    keywords: [
      'masonry', 'brick', 'block', 'concrete', 'cement', 'mortar', 'plaster', 'render',
      'wall construction', 'pillar', 'column', 'driveway', 'paving', 'steps', 'stair',
      'plastering', 'rendering', 'crack repair', 'concrete repair',
      'brick wall', 'garden wall', 'boundary wall', 'partition',
      'சிமெண்ட்', 'கான்கிரீட்', ' சுவர்', 'தச்சு', ' கட்டிடம்',
      'ඉදිකිරීම්', 'ගඩොල්', 'සිමෙන්ති', 'බිත්ති', 'තැනීම',
    ],
    subServices: [
      { id: 'brick-wall', name: 'Brick and block wall construction', keywords: ['brick', 'block', 'wall', 'construction', 'boundary'] },
      { id: 'concrete-slab', name: 'Concrete slab pour', keywords: ['concrete', 'slab', 'pour', 'foundation', 'floor'] },
      { id: 'plaster', name: 'Plastering and rendering', keywords: ['plaster', 'render', 'plastering', 'rendering', 'smooth wall'] },
      { id: 'crack-repair', name: 'Concrete crack repair', keywords: ['crack', 'repair', 'concrete crack', 'wall crack'] },
      { id: 'pillar', name: 'Pillar and column construction', keywords: ['pillar', 'column', 'structural', 'support'] },
      { id: 'driveway', name: 'Driveway paving', keywords: ['driveway', 'paving', 'paver', 'interlock', 'asphalt'] },
      { id: 'garden-wall', name: 'Garden wall building', keywords: ['garden wall', 'retaining wall', 'planter', 'decorative wall'] },
      { id: 'steps', name: 'Steps and stair construction', keywords: ['steps', 'stair', 'staircase', 'entrance', 'step'] },
    ],
  },
  {
    id: 'roofing-and-gutters', name: 'Roofing and Gutters', icon: 'home', colorHex: '#DC2626',
    keywords: [
      'roof', 'roofing', 'gutter', 'gutters', 'ceiling', 'leak',
      'roof leak', 'roof repair', 'roof tile', 'skylight', 'fascia', 'soffit',
      'waterproof roof', 'roof inspection', 'roof maintenance',
      'மழை கசிவு', 'கூரை', 'குழாய்',
      'ශීර්ෂය', 'ගෙහි වහලය', 'ජල කාන්දු',
    ],
    subServices: [
      { id: 'roof-leak', name: 'Roof leak repair', keywords: ['roof leak', 'leak', 'roof repair', 'water leak roof'] },
      { id: 'roof-tile', name: 'Roof tile replacement', keywords: ['roof tile', 'tile replacement', 'broken tile'] },
      { id: 'gutter', name: 'Gutter cleaning and repair', keywords: ['gutter', 'gutter clean', 'gutter repair', 'downpipe'] },
      { id: 'gutter-install', name: 'Gutter installation', keywords: ['gutter install', 'new gutter', 'gutter system'] },
      { id: 'ceiling-leak', name: 'Ceiling leak repair', keywords: ['ceiling leak', 'ceiling repair', 'water damage ceiling'] },
      { id: 'roof-inspect', name: 'Roof inspection and maintenance', keywords: ['roof inspection', 'roof check', 'roof maintenance'] },
      { id: 'skylight', name: 'Skylight installation', keywords: ['skylight', 'roof window', 'sky light'] },
      { id: 'fascia', name: 'Fascia and soffit repair', keywords: ['fascia', 'soffit', 'roof edge', 'board repair'] },
    ],
  },
  {
    id: 'pest-control', name: 'Pest Control', icon: 'bug', colorHex: '#65A30D',
    keywords: [
      'pest', 'pest control', 'pestcontrol', 'insect', 'bug',
      'cockroach', 'cockroaches', 'roach', 'ant', 'ants',
      'termite', 'termites', 'white ant',
      'rat', 'rats', 'mouse', 'mice', 'rodent',
      'mosquito', 'mosquitoes', 'fogging',
      'bed bug', 'bed bugs',
      'lizard', 'gecko', 'snake',
      'fumigate', 'fumigation', 'spray', 'insecticide',
      'pests in my house', 'bugs everywhere', 'termite damage',
      'பூச்சி', 'கரப்பான்', 'கொசு', 'விஷ பூச்சி',
      'කෘමි', 'කොක්ක්රෝච්', 'මදුරු', 'කෘමි පාලන',
    ],
    subServices: [
      { id: 'general-pest', name: 'General pest control treatment', keywords: ['general', 'pest control', 'treatment', 'spray'] },
      { id: 'termite', name: 'Termite inspection and treatment', keywords: ['termite', 'white ant', 'inspection', 'treatment'] },
      { id: 'mosquito', name: 'Mosquito control', keywords: ['mosquito', 'fogging', 'mosquito spray', 'breeding'] },
      { id: 'rodent', name: 'Rodent control and removal', keywords: ['rat', 'mouse', 'rodent', 'trap', 'removal'] },
      { id: 'bed-bug', name: 'Bed bug treatment', keywords: ['bed bug', 'bedbug', 'mattress', 'treatment'] },
      { id: 'lizard', name: 'Lizard and gecko control', keywords: ['lizard', 'gecko', 'removal', 'repellent'] },
      { id: 'flea', name: 'Flea and tick treatment', keywords: ['flea', 'tick', 'pet pest', 'garden pest'] },
      { id: 'wood-borer', name: 'Wood borer treatment', keywords: ['wood borer', 'borer', 'powderpost', 'wood damage'] },
    ],
  },
  {
    id: 'cleaning-services', name: 'Cleaning Services', icon: 'sparkles', colorHex: '#0EA5E9',
    keywords: [
      'cleaning', 'clean', 'cleaner', 'cleanin', 'clene', 'clening', 'clane',
      'maid', 'housekeeping', 'house clean', 'home clean', 'office clean',
      'vacuum', 'mop', 'moping', 'mopping', 'sweep', 'sweap',
      'dust', 'dusting', 'scrub', 'sanitize', 'sanitise', 'disinfect',
      'bathroom clean', 'kitchen clean', 'deep clean', 'move out clean',
      'carpet clean', 'window clean', 'sofa clean', 'upholstery',
      'post construction clean',
      'my house is dirty', 'need cleaning', 'deep cleaning',
      'சுத்தம்', 'துப்புரவு', 'சுத்திகரிப்பு', 'துடை', 'அழி', 'துவை', 'சலவை', 'சுத்தம் பண்ணு',
      'පිරිසිදු', 'පිරිසිදු කිරීම', 'සෝදා', 'මොප්', 'කුණු', 'දූවිලි', 'සනීපාරක්ෂක', 'සාෆ්', 'සාෆ් කරන්න',
    ],
    subServices: [
      { id: 'deep-clean', name: 'Home deep cleaning', keywords: ['deep clean', 'home clean', 'full clean', 'thorough'] },
      { id: 'office-clean', name: 'Office cleaning', keywords: ['office', 'commercial', 'workplace', 'office clean'] },
      { id: 'kitchen-clean', name: 'Kitchen deep cleaning', keywords: ['kitchen', 'kitchen clean', 'oven', 'grease'] },
      { id: 'bathroom-clean', name: 'Bathroom deep cleaning', keywords: ['bathroom', 'bathroom clean', 'toilet', 'scrub'] },
      { id: 'sofa-clean', name: 'Sofa and upholstery cleaning', keywords: ['sofa', 'upholstery', 'couch', 'furniture clean'] },
      { id: 'window-clean', name: 'Window cleaning', keywords: ['window', 'glass', 'window clean', 'streak-free'] },
      { id: 'move-clean', name: 'Move-in/move-out cleaning', keywords: ['move in', 'move out', 'end of lease', 'tenant clean'] },
      { id: 'carpet-clean', name: 'Carpet steam cleaning', keywords: ['carpet', 'steam clean', 'carpet clean', 'shampoo'] },
      { id: 'post-const-clean', name: 'Post-construction cleaning', keywords: ['post construction', 'renovation clean', 'builder clean'] },
    ],
  },
  {
    id: 'gardening-and-landscaping', name: 'Gardening and Landscaping', icon: 'leaf', colorHex: '#16A34A',
    keywords: [
      'gardening', 'garden', 'gardan', 'graden', 'gardener', 'gardenir',
      'lawn', 'lawn mow', 'mowing', 'grass', 'grass cut',
      'plant', 'plants', 'planting', 'tree', 'tree trim', 'pruning',
      'weed', 'weeding', 'landscape', 'landscaping',
      'hedge', 'hedge trim', 'fertilizer', 'irrigation',
      'flower', 'flowers', 'shrub', 'bush',
      'my garden is messy', 'need garden work', 'overgrown garden',
      'தோட்டம்', 'தோட்ட வேலை', 'புல்', 'செடி', 'மரம்', 'மலர்', 'நில அமைப்பு', 'வெட்டு', 'களை',
      'උද්‍යාන', 'වත්ත', 'තණකොළ', 'පැල', 'ගස', 'මල්', 'භූමි අලංකරණ', 'මිදුල', 'ගස් කපන', 'කොස්',
    ],
    subServices: [
      { id: 'garden-maint', name: 'Garden maintenance', keywords: ['garden', 'maintenance', 'regular', 'upkeep'] },
      { id: 'lawn-mow', name: 'Lawn mowing and care', keywords: ['lawn', 'mow', 'mowing', 'grass', 'cut grass'] },
      { id: 'tree-trim', name: 'Tree trimming and pruning', keywords: ['tree', 'trim', 'prune', 'pruning', 'branch'] },
      { id: 'hedge', name: 'Hedge trimming', keywords: ['hedge', 'bush', 'shrub', 'trim', 'shape'] },
      { id: 'planting', name: 'Planting and garden design', keywords: ['plant', 'planting', 'design', 'flower', 'garden design'] },
      { id: 'turf', name: 'Lawn renovation and turf installation', keywords: ['turf', 'lawn', 'seed', 'renovate', 'grass install'] },
      { id: 'irrigation', name: 'Irrigation system installation', keywords: ['irrigation', 'sprinkler', 'drip', 'watering system'] },
      { id: 'compost', name: 'Compost and soil preparation', keywords: ['compost', 'soil', 'fertilizer', 'amendment'] },
      { id: 'pond', name: 'Pond and water feature maintenance', keywords: ['pond', 'fountain', 'water feature', 'fish pond'] },
    ],
  },
  {
    id: 'home-security-and-automation', name: 'Home Security and Automation', icon: 'lock-closed', colorHex: '#1E293B',
    keywords: [
      'security', 'cctv', 'camera', 'surveillance', 'smart lock', 'alarm',
      'doorbell', 'video doorbell', 'smart home', 'automation',
      'electric fence', 'gate automation', 'intercom',
      'smoke detector', 'gas detector', 'fire alarm',
      'security system', 'home security', 'protect my home',
      'சிசிடிவி', 'பாதுகாப்பு', 'ஸ்மார்ட் லாக்',
      'ආරක්ෂාව', 'CCTV', 'ස්මාර්ට් ලොක්', 'අලාරම්',
    ],
    subServices: [
      { id: 'cctv', name: 'CCTV camera installation', keywords: ['cctv', 'camera', 'surveillance', 'security camera', 'nvr'] },
      { id: 'smart-lock', name: 'Smart lock installation', keywords: ['smart lock', 'electronic lock', 'keypad', 'fingerprint'] },
      { id: 'alarm', name: 'Alarm system installation', keywords: ['alarm', 'burglar', 'siren', 'sensor'] },
      { id: 'video-doorbell', name: 'Video doorbell installation', keywords: ['doorbell', 'video doorbell', 'smart doorbell', 'ring'] },
      { id: 'smart-home', name: 'Smart home hub setup', keywords: ['smart home', 'hub', 'alexa', 'google home', 'automation'] },
      { id: 'electric-fence', name: 'Electric fence installation', keywords: ['electric fence', 'perimeter', 'fence', 'energizer'] },
      { id: 'gate-auto', name: 'Gate automation', keywords: ['gate', 'automatic gate', 'gate opener', 'remote gate'] },
      { id: 'intercom', name: 'Intercom system installation', keywords: ['intercom', 'entry system', 'video intercom'] },
      { id: 'smoke-detector', name: 'Smoke and gas detector installation', keywords: ['smoke', 'gas', 'detector', 'fire', 'carbon monoxide'] },
    ],
  },
  {
    id: 'moving-and-packing', name: 'Moving and Packing', icon: 'car', colorHex: '#F97316',
    keywords: [
      'moving', 'move', 'mover', 'movers', 'shifting', 'shift',
      'relocation', 'relocate', 'transport', 'transportation',
      'packing', 'pack', 'packers', 'unpack', 'packing service',
      'loading', 'unloading', 'loading unloading',
      'home move', 'office move', 'house shifting',
      'van', 'lorry', 'truck', 'cab',
      'i am moving', 'need to shift', 'help me move',
      'நகர்த்த', 'இடமாற்ற', 'நகர்வு', 'சுமை', 'ஏற்றி', 'இறக்கி', 'பார்சல்', 'ஷிப்டிங்',
      'ගෙනයන්න', 'මාරු', 'ප්‍රවාහන', 'බඩු', 'පැකේජ', 'බාගන්න', 'උඩුගත', 'ෂිෆ්ටින්',
    ],
    subServices: [
      { id: 'local-move', name: 'Local moving service', keywords: ['local move', 'moving', 'transport', 'shift'] },
      { id: 'packing', name: 'Packing service', keywords: ['packing', 'pack', 'boxes', 'materials'] },
      { id: 'furniture-move', name: 'Furniture disassembly and assembly', keywords: ['furniture', 'disassemble', 'assemble', 'take apart'] },
      { id: 'piano', name: 'Piano moving', keywords: ['piano', 'piano move', 'heavy item', 'specialized'] },
      { id: 'vehicle-transport', name: 'Vehicle transport', keywords: ['vehicle', 'car transport', 'flatbed', 'enclosed'] },
      { id: 'storage', name: 'Storage solutions', keywords: ['storage', 'temporary', 'store', 'warehouse'] },
      { id: 'office-reloc', name: 'Office relocation', keywords: ['office', 'relocation', 'business move', 'corporate'] },
      { id: 'waste-remove', name: 'Waste removal after move', keywords: ['waste', 'debris', 'cleanup', 'box removal'] },
    ],
  },
  {
    id: 'vehicle-care-and-maintenance', name: 'Vehicle Care and Maintenance', icon: 'car-sport', colorHex: '#6366F1',
    keywords: [
      'car', 'vehicle', 'auto', 'motor', 'motorcycle', 'bike',
      'car wash', 'detailing', 'wax', 'polish', 'interior clean',
      'oil change', 'tire', 'tyre', 'battery', 'brake',
      'ac service vehicle', 'car ac', 'paint protection',
      'my car needs washing', 'car service', 'bike service',
      'வண்டி', 'கார்', 'மோட்டாර்', ' சர்வீஸ்', 'எண்ணெய்', 'டயர்',
      'වාහනය', 'කාර්', 'මෝටර්', 'ටයර්', 'බැටරි', 'බ්‍රේක්',
    ],
    subServices: [
      { id: 'car-wash', name: 'Car washing and detailing', keywords: ['car wash', 'wash', 'detailing', 'clean car'] },
      { id: 'car-wax', name: 'Car waxing and polishing', keywords: ['wax', 'polish', 'shine', 'buff'] },
      { id: 'car-interior', name: 'Interior deep cleaning', keywords: ['interior', 'interior clean', 'seat', 'carpet clean'] },
      { id: 'oil-change', name: 'Oil change service', keywords: ['oil change', 'oil', 'filter', 'service'] },
      { id: 'tire', name: 'Tire change and rotation', keywords: ['tire', 'tyre', 'wheel', 'rotation', 'change tire'] },
      { id: 'car-ac', name: 'AC service for vehicles', keywords: ['car ac', 'vehicle ac', 'ac gas', 'car cooling'] },
      { id: 'battery', name: 'Battery replacement', keywords: ['battery', 'car battery', 'battery replace', 'jump start'] },
      { id: 'motorcycle', name: 'Motorcycle servicing', keywords: ['motorcycle', 'bike', 'motorcycle service', 'chain'] },
      { id: 'paint-protection', name: 'Paint protection film application', keywords: ['paint protection', 'ppf', 'film', 'clear coat'] },
    ],
  },
  {
    id: 'it-and-electronics-repair', name: 'IT and Electronics Repair', icon: 'desktop', colorHex: '#8B5CF6',
    keywords: [
      'computer', 'laptop', 'desktop', 'pc', 'mac', 'macbook',
      'phone', 'smartphone', 'mobile', 'iphone', 'samsung', 'android',
      'screen', 'screen replacement', 'screen repair', 'cracked screen',
      'wifi', 'wi-fi', 'internet', 'network', 'router',
      'data', 'backup', 'recovery', 'printer',
      'tv', 'television', 'tv mount', 'tv mounting',
      'software', 'install', 'update', 'virus', 'malware',
      'tech', 'electronics', 'gadget', 'device',
      'my computer is slow', 'phone screen broken', 'wifi not working',
      'கணினி', 'லேப்டாப்', 'மொபைல்', 'திரை', 'வைஃபை', 'பிரிண்டர்',
      'පරිගණක', 'ලැප්ටොප්', 'මොබයිල්', 'තිරය', 'වයිෆයි', 'ප්‍රින්ටරය',
    ],
    subServices: [
      { id: 'computer-repair', name: 'Computer repair and troubleshooting', keywords: ['computer', 'pc', 'repair', 'troubleshoot', 'fix'] },
      { id: 'screen-replace', name: 'Smartphone screen replacement', keywords: ['phone', 'screen', 'crack', 'replace', 'display'] },
      { id: 'laptop-battery', name: 'Laptop battery replacement', keywords: ['laptop', 'battery', 'replace', 'charging'] },
      { id: 'wifi-setup', name: 'Wi-Fi network setup', keywords: ['wifi', 'wi-fi', 'internet', 'router', 'network'] },
      { id: 'data-recovery', name: 'Data backup and recovery', keywords: ['data', 'backup', 'recovery', 'files', 'lost data'] },
      { id: 'printer', name: 'Printer setup and repair', keywords: ['printer', 'print', 'paper jam', 'ink'] },
      { id: 'tv-mount', name: 'TV mounting and setup', keywords: ['tv', 'television', 'mount', 'wall mount', 'setup'] },
      { id: 'smart-device', name: 'Smart home device setup', keywords: ['smart device', 'alexa', 'google', 'iot', 'smart speaker'] },
      { id: 'cctv-setup', name: 'CCTV and security system setup', keywords: ['cctv', 'camera', 'nvr', 'security', 'ip camera'] },
      { id: 'software', name: 'Software installation and updates', keywords: ['software', 'install', 'update', 'os', 'windows'] },
    ],
  },
  {
    id: 'event-and-party-services', name: 'Event and Party Services', icon: 'musical-notes', colorHex: '#F43F5E',
    keywords: [
      'event', 'events', 'party', 'parties', 'wedding', 'celebration',
      'decoration', 'decor', 'setup', 'arrangement',
      'sound', 'audio', 'speaker', 'microphone', 'dj', 'music',
      'lighting', 'light', 'tent', 'canopy', 'marquee',
      'photography', 'photo', 'video', 'videography',
      'catering', 'food', 'buffet', 'cater',
      'balloon', 'bouncy castle', 'inflatable',
      'i am planning a party', 'need event setup',
      'நிகழ்வு', 'விழா', 'திருமணம்', 'அலங்காரம்', 'ஒலி', 'ஒளி',
      'සිදුවීම', 'පාර්ටි', 'විවාහය', 'ආලංකරණය', 'ශබ්දය', 'ආලෝකය',
    ],
    subServices: [
      { id: 'event-decor', name: 'Event decoration setup', keywords: ['decoration', 'decor', 'setup', 'theme', 'wedding decor'] },
      { id: 'sound-system', name: 'Sound system setup', keywords: ['sound', 'audio', 'speaker', 'pa system', 'microphone'] },
      { id: 'event-light', name: 'Lighting setup for events', keywords: ['lighting', 'event light', 'dj light', 'mood light'] },
      { id: 'tent', name: 'Tent and canopy rental setup', keywords: ['tent', 'canopy', 'marquee', 'outdoor'] },
      { id: 'photography', name: 'Photography and videography', keywords: ['photo', 'video', 'photography', 'videography', 'camera'] },
      { id: 'catering', name: 'Catering setup service', keywords: ['catering', 'food', 'buffet', 'dining'] },
      { id: 'dj', name: 'DJ and entertainment service', keywords: ['dj', 'music', 'entertainment', 'mc'] },
      { id: 'bouncy', name: 'Bouncy castle and inflatable setup', keywords: ['bouncy', 'castle', 'inflatable', 'kids', 'bounce'] },
      { id: 'balloon', name: 'Balloon decoration service', keywords: ['balloon', 'arch', 'column', 'centerpiece'] },
    ],
  },
  {
    id: 'personal-care-and-wellness', name: 'Personal Care and Wellness', icon: 'body', colorHex: '#D946EF',
    keywords: [
      'personal', 'care', 'wellness', 'massage', 'therapy',
      'haircut', 'hair', 'styling', 'salon', 'barber',
      'makeup', 'grooming', 'facial', 'skincare',
      'manicure', 'pedicure', 'nail', 'nails',
      'yoga', 'meditation', 'fitness', 'training', 'gym',
      'elderly', 'senior', 'care', 'babysitting', 'child care', 'babysitter',
      'i need a massage', 'need haircut', 'need babysitter',
      'மசாஜ்', 'தலைமுடி', 'ஒப்பனை', 'யோகா', 'பயிற்சி', 'குழந்தை பராமரிப்பு',
      'සම්බාහනය', 'කෙස්', 'මේක්අප්', 'යෝගා', 'පුහුණුව', 'ළමා සේවය',
    ],
    subServices: [
      { id: 'massage', name: 'Massage therapy at home', keywords: ['massage', 'therapy', 'relaxation', 'body massage'] },
      { id: 'haircut', name: 'Haircut and styling at home', keywords: ['haircut', 'hair', 'cut', 'styling', 'barber', 'salon'] },
      { id: 'makeup', name: 'Makeup and grooming service', keywords: ['makeup', 'grooming', 'beauty', 'cosmetic'] },
      { id: 'manicure', name: 'Manicure and pedicure', keywords: ['manicure', 'pedicure', 'nail', 'nails', 'polish'] },
      { id: 'facial', name: 'Facial and skincare treatment', keywords: ['facial', 'skincare', 'skin', 'treatment', 'glow'] },
      { id: 'training', name: 'Personal training session', keywords: ['training', 'fitness', 'gym', 'workout', 'exercise'] },
      { id: 'yoga', name: 'Yoga and meditation instruction', keywords: ['yoga', 'meditation', 'mindfulness', 'breathing'] },
      { id: 'elderly', name: 'Elderly care assistance', keywords: ['elderly', 'senior', 'old age', 'caregiver'] },
      { id: 'childcare', name: 'Child care and babysitting', keywords: ['child care', 'babysitting', 'babysitter', 'kids', 'nanny'] },
    ],
  },
  {
    id: 'home-renovation-and-interiors', name: 'Home Renovation and Interiors', icon: 'business', colorHex: '#0D9488',
    keywords: [
      'renovation', 'renovate', 'remodel', 'upgrade', 'overhaul', 'refurbish',
      'interior', 'design', 'decoration', 'modern',
      'bathroom renovation', 'kitchen renovation', 'room renovation',
      'false ceiling', 'partition', 'wall partition',
      'closet', 'storage', 'wardrobe', 'staircase',
      'window replacement', 'interior design',
      'i want to renovate', 'remodel my house', 'kitchen remodel',
      'புதுப்பித்தல்', ' சீரமைப்பு', ' வடிவமைப்பு', ' உள்ளரங்கம்',
      'ප්‍රතිසංස්කරණ', ' නිර්මාණ', 'අභ්‍යන්තර',
    ],
    subServices: [
      { id: 'full-room', name: 'Full room renovation', keywords: ['full room', 'complete', 'renovation', 'overhaul'] },
      { id: 'bath-reno', name: 'Bathroom renovation', keywords: ['bathroom', 'bathroom reno', 'remodel bathroom'] },
      { id: 'kitchen-reno', name: 'Kitchen renovation', keywords: ['kitchen', 'kitchen reno', 'remodel kitchen', 'cabinet'] },
      { id: 'false-ceiling', name: 'False ceiling installation', keywords: ['false ceiling', 'ceiling', 'dropped ceiling', 'gypsum'] },
      { id: 'partition', name: 'Partition wall construction', keywords: ['partition', 'divider', 'wall', 'separate room'] },
      { id: 'closet-design', name: 'Closet and storage design', keywords: ['closet', 'storage', 'wardrobe', 'custom storage'] },
      { id: 'staircase-reno', name: 'Staircase renovation', keywords: ['staircase', 'stairs', 'stair', 'renovate'] },
      { id: 'window-replace', name: 'Window replacement', keywords: ['window', 'replace', 'new window', 'energy efficient'] },
      { id: 'interior-design', name: 'Interior design consultation', keywords: ['interior design', 'consultation', 'design', 'decor advice'] },
    ],
  },
  {
    id: 'solar-and-energy-solutions', name: 'Solar and Energy Solutions', icon: 'sunny', colorHex: '#EAB308',
    keywords: [
      'solar', 'sun', 'energy', 'panel', 'solar panel',
      'inverter', 'battery', 'battery storage', 'backup power',
      'solar water heater', 'solar pump', 'solar light',
      'energy audit', 'renewable', 'green energy',
      'wind turbine', 'solar street light',
      'i want solar panels', 'need solar', 'power backup solution',
      'சூரிய', 'சோலார்', ' மின்சாரம்', ' பேட்டரி', ' இன்வெர்ட்டர்',
      'සූර්ය', 'සෝලාර්', 'බලය', 'බැටරි', 'අන්වර්ථකාරක',
    ],
    subServices: [
      { id: 'solar-panel', name: 'Solar panel installation', keywords: ['solar panel', 'panel install', 'pv', 'photovoltaic'] },
      { id: 'solar-water', name: 'Solar water heater installation', keywords: ['solar water heater', 'water heater', 'solar hot water'] },
      { id: 'inverter', name: 'Inverter installation', keywords: ['inverter', 'backup', 'power inverter'] },
      { id: 'battery-storage', name: 'Battery storage system setup', keywords: ['battery', 'storage', 'battery bank', 'lithium'] },
      { id: 'solar-pump', name: 'Solar pump installation', keywords: ['solar pump', 'water pump', 'solar water'] },
      { id: 'energy-audit', name: 'Energy audit and consultation', keywords: ['energy audit', 'audit', 'consultation', 'assessment'] },
      { id: 'solar-street', name: 'Solar street light installation', keywords: ['solar light', 'street light', 'outdoor light', 'solar lamp'] },
      { id: 'solar-maint', name: 'Solar maintenance and cleaning', keywords: ['solar maintenance', 'panel clean', 'solar service'] },
      { id: 'wind', name: 'Wind turbine installation', keywords: ['wind turbine', 'wind energy', 'turbine'] },
    ],
  },
  {
    id: 'handyman-and-general-repairs', name: 'Handyman and General Repairs', icon: 'wrench', colorHex: '#475569',
    keywords: [
      'handyman', 'odd jobs', 'general repair', 'general repairs', 'general handyman',
      'fix', 'fixing', 'repair', 'assembly', 'assemble', 'furniture assembly', 'wardrobe assembly',
      'shelf', 'shelf installation', 'hang', 'hanging', 'mounting', 'curtain rod', 'blind', 'mirror',
      'picture hanging', 'drawer', 'hinge', 'door handle', 'caulking', 'silicone', 'small jobs',
      'help around the house', 'handyman service',
      'சிறு வேலை', 'பழுது', 'அசெம்பிளி', 'பொருள்', 'சுவரில் மாட்ட', 'கைவைத்தல்',
      'සුළු අලුත්වැඩියා', 'සාමාන්ය අලුත්වැඩියා', 'එකලස් කිරීම', 'රාක්කය', 'එල්ලීම', 'අගුලු',
    ],
    subServices: [
      { id: 'handyman-assembly', name: 'Cupboard and wardrobe assembly', keywords: ['wardrobe', 'cupboard', 'almirah', 'almira assembly', 'wardrobe assembly'] },
      { id: 'bed-assembly', name: 'Wooden bed assembly', keywords: ['bed assembly', 'bed frame', 'wooden bed', 'assemble bed'] },
      { id: 'table-chair-assembly', name: 'Table and chair assembly', keywords: ['table assembly', 'desk assembly', 'chair assembly', 'office chair', 'dining table'] },
      { id: 'bookshelf-assembly', name: 'Bookshelf assembly', keywords: ['bookshelf', 'shelf assembly', 'book rack', 'bookcase'] },
      { id: 'cabinet-assembly', name: 'Cabinet assembly', keywords: ['cabinet assembly', 'kitchen cabinet', 'storage cabinet'] },
      { id: 'furniture-disassembly', name: 'Furniture disassembly', keywords: ['disassemble', 'dismantle furniture', 'break down furniture'] },
      { id: 'shelf-install', name: 'Shelf installation', keywords: ['shelf', 'install shelf', 'wall shelf', 'shelf mounting', 'bracket'] },
      { id: 'curtain-rod', name: 'Curtain rod installation', keywords: ['curtain rod', 'curtain rail', 'rod installation'] },
      { id: 'blind-install', name: 'Blind installation', keywords: ['blind', 'blinds', 'install blinds', 'venetian'] },
      { id: 'mirror-hang', name: 'Mirror hanging', keywords: ['mirror', 'hang mirror', 'mirror mounting', 'wall mirror'] },
      { id: 'picture-hang', name: 'Picture and frame hanging', keywords: ['picture', 'frame', 'wall art', 'canvas', 'photo hanging'] },
      { id: 'wall-hook', name: 'Wall hook installation', keywords: ['wall hook', 'hook', 'towel rail', 'key rack'] },
      { id: 'drawer-repair', name: 'Drawer repair', keywords: ['drawer', 'drawer slide', 'stuck drawer', 'drawer runner'] },
      { id: 'hinge-repair', name: 'Cabinet hinge repair', keywords: ['hinge', 'cabinet hinge', 'hinge repair', 'door alignment'] },
      { id: 'handle-replacement', name: 'Furniture handle replacement', keywords: ['handle', 'knob', 'pull', 'furniture handle'] },
      { id: 'door-handle', name: 'Door handle replacement', keywords: ['door handle', 'doorknob', 'handle replacement'] },
      { id: 'door-hinge', name: 'Door hinge repair and replacement', keywords: ['door hinge', 'sagging door', 'door repair', 'hinge replacement'] },
      { id: 'door-alignment', name: 'Door alignment and adjustment', keywords: ['door alignment', 'sticking door', 'door adjustment', 'door leveling'] },
      { id: 'window-handle', name: 'Window handle and lock repair', keywords: ['window handle', 'window lock', 'window catch', 'window stay'] },
      { id: 'wall-repair', name: 'Minor wall repair', keywords: ['wall repair', 'patch hole', 'fill crack', 'plaster patch', 'wall dent'] },
      { id: 'caulking', name: 'Silicone and caulking work', keywords: ['silicone', 'caulk', 'caulking', 'sealant', 'sealing'] },
      { id: 'handyman-service', name: 'General handyman service', keywords: ['handyman', 'handyman service', 'odd jobs', 'general repairs', 'fix'] },
      { id: 'multi-jobs', name: 'Multiple small jobs', keywords: ['small jobs', 'multiple jobs', 'odd jobs', 'batch jobs'] },
    ],
  },
  {
    id: 'glass-and-aluminium', name: 'Glass and Aluminium', icon: 'diamond', colorHex: '#0369A1',
    keywords: [
      'glass', 'glazing', 'glass repair', 'glass installation', 'window glass', 'glass door',
      'aluminium', 'aluminum', 'aluminium windows', 'aluminium doors', 'sliding door', 'partition',
      'shower glass', 'mirror', 'glass replacement', 'mosquito net', 'window replacement',
      'glass broken', 'broken glass',
      'கண்ணாடி', 'அலுமினியம்', 'ஜன்னல்', 'கண்ணாடி கதவு', 'கண்ணாடி மாற்று',
      'වීදුරු', 'ඇලුමිනියම්', 'ජනෙල්', 'වීදුරු දොර', 'වීදුරු අලුත්වැඩියා',
    ],
    subServices: [
      { id: 'glass-door', name: 'Glass door installation', keywords: ['glass door', 'glass door install', 'patio door'] },
      { id: 'glass-window', name: 'Glass window installation', keywords: ['glass window', 'window install', 'glass window fitting'] },
      { id: 'glass-replacement', name: 'Window glass replacement', keywords: ['glass replacement', 'replace glass', 'broken glass', 'cracked window'] },
      { id: 'aluminium-door', name: 'Aluminium door installation', keywords: ['aluminium door', 'aluminum door', 'sliding door install'] },
      { id: 'aluminium-window', name: 'Aluminium window installation', keywords: ['aluminium window', 'aluminum window', 'aluminium frame'] },
      { id: 'sliding-repair', name: 'Sliding door and window repair', keywords: ['sliding door repair', 'sliding window', 'roller repair', 'track repair'] },
      { id: 'shower-glass', name: 'Shower glass installation', keywords: ['shower glass', 'shower screen', 'glass enclosure', 'cabinet glass'] },
      { id: 'partition', name: 'Glass partition installation', keywords: ['partition', 'glass partition', 'office partition', 'room divider'] },
      { id: 'mirror-install', name: 'Mirror installation', keywords: ['mirror install', 'fit mirror', 'vanity mirror', 'wardrobe mirror'] },
      { id: 'aluminium-repair', name: 'Aluminium frame repair', keywords: ['frame repair', 'aluminium frame', 'frame fix', 'corroded frame'] },
      { id: 'mosquito-net', name: 'Mosquito net installation', keywords: ['mosquito net', 'mosquito mesh', 'window screen', 'insect screen'] },
    ],
  },
  {
    id: 'appliance-installation-and-repair', name: 'Appliance Installation and Repair', icon: 'hardware-chip', colorHex: '#B45309',
    keywords: [
      'appliance', 'appliances', 'appliance repair', 'appliance installation', 'washing machine',
      'refrigerator', 'fridge', 'dishwasher', 'microwave', 'oven', 'water purifier', 'water filter',
      'cooker', 'dryer', 'install appliance', 'fix appliance', 'washing machine repair',
      'fridge not working', 'appliance install',
      'சலவை இயந்திரம்', 'குளிர்சாதனம்', 'மின்சாதனம்', 'அடுப்பு', 'மைக்ரோவேவ்', 'சாதனம்',
      'රෙදි සෝදන යන්ත්ර', 'ශීතකරණය', 'ගෘහ උපකරණ', 'උදුන', 'වතුර පෙරහන', 'උපාංග',
    ],
    subServices: [
      { id: 'washer-install', name: 'Washing machine installation', keywords: ['washing machine install', 'washer install', 'machine fitting', 'lejana' ] },
      { id: 'washer-repair', name: 'Washing machine repair', keywords: ['washing machine repair', 'washer repair', 'washing machine not working'] },
      { id: 'fridge-install', name: 'Refrigerator installation', keywords: ['refrigerator install', 'fridge install', 'fridge fitting'] },
      { id: 'fridge-repair', name: 'Refrigerator repair', keywords: ['refrigerator repair', 'fridge repair', 'fridge not cooling', 'refrigerator not cooling'] },
      { id: 'dishwasher-install', name: 'Dishwasher installation', keywords: ['dishwasher install', 'dishwasher fitting'] },
      { id: 'microwave-install', name: 'Microwave installation', keywords: ['microwave install', 'microwave fitting', 'built in microwave'] },
      { id: 'oven-install', name: 'Oven installation', keywords: ['oven install', 'built in oven', 'oven fitting', 'electric oven'] },
      { id: 'purifier-install', name: 'Water purifier installation', keywords: ['water purifier', 'ro purifier', 'purifier install', 'uv purifier'] },
      { id: 'filter-install', name: 'Water filter installation', keywords: ['water filter', 'filter install', 'under sink filter'] },
      { id: 'cooker-install', name: 'Electric cooker installation', keywords: ['electric cooker', 'cooker install', 'hob install', 'electric hob'] },
      { id: 'dryer-install', name: 'Clothes dryer installation', keywords: ['dryer install', 'clothes dryer', 'tumble dryer'] },
      { id: 'small-appliance', name: 'Small appliance repair', keywords: ['small appliance', 'kettle repair', 'mixer repair', 'iron repair', 'small appliance repair'] },
    ],
  },
  {
    id: 'locksmith-services', name: 'Locksmith Services', icon: 'key', colorHex: '#3F3F46',
    keywords: [
      'locksmith', 'lock', 'locks', 'key', 'keys', 'key duplication', 'duplicate key', 'unlock',
      'door lock', 'lock installation', 'lock repair', 'smart lock', 'digital lock', 'safe lock',
      'padlock', 'locked out', 'cannot open door', 'lock change',
      'பூட்டு', 'சாவி', 'பூட்டு மாற்ற', 'பூட்டு பழுது', 'பூட்டை திற', 'சாவி நகல்',
      'අගුලු', 'යතුරු', 'අගුලු වෙනස් කිරීම', 'අගුලු අලුත්වැඩියා', 'යතුරු පිටපත්',
    ],
    subServices: [
      { id: 'lock-install', name: 'Lock installation', keywords: ['lock install', 'install lock', 'new lock', 'mortise lock'] },
      { id: 'lock-replace', name: 'Lock replacement', keywords: ['lock replacement', 'change lock', 'replace lock', 'lock change'] },
      { id: 'lock-repair', name: 'Lock repair', keywords: ['lock repair', 'fix lock', 'jam lock', 'stiff lock'] },
      { id: 'door-unlock', name: 'Door unlocking', keywords: ['unlock', 'unlock door', 'locked out', 'open locked door'] },
      { id: 'key-copy', name: 'Key duplication', keywords: ['key duplication', 'duplicate key', 'copy key', 'key cutting'] },
      { id: 'smart-lock', name: 'Smart lock installation', keywords: ['smart lock', 'digital lock install', 'fingerprint lock', 'electronic lock'] },
      { id: 'digital-lock-repair', name: 'Digital lock repair', keywords: ['digital lock repair', 'electronic lock repair', 'keypad lock'] },
      { id: 'safe-opening', name: 'Safe and locker opening', keywords: ['safe opening', 'locker opening', 'open safe', 'cabinet lock'] },
      { id: 'emergency-lock', name: 'Emergency locksmith service', keywords: ['emergency locksmith', '24/7 locksmith', 'urgent lock', 'lock out emergency'] },
    ],
  },
  {
    id: 'curtains-blinds-and-upholstery', name: 'Curtains, Blinds and Upholstery', icon: 'shirt', colorHex: '#DB2777',
    keywords: [
      'curtain', 'curtains', 'curtain installation', 'curtain rod', 'curtain track', 'blind', 'blinds',
      'roller blind', 'venetian', 'upholstery', 'sofa repair', 're-upholstery', 'reupholster',
      'chair upholstery', 'cushion', 'curtain cleaning', 'curtain repair', 'window treatment',
      'திரைச்சீலை', 'திரை', 'சோபா', 'மெத்தை', 'திரை சுத்தம்', 'தையல் வேலை',
      'තිර', 'තිර රෙදි', 'සෝෆා', 'කොට්ට', 'තිර පිරිසිදු කිරීම',
    ],
    subServices: [
      { id: 'curtain-install', name: 'Curtain installation', keywords: ['curtain install', 'hang curtains', 'curtain fitting', 'drapery'] },
      { id: 'curtain-rod', name: 'Curtain rod installation', keywords: ['curtain rod', 'curtain rail', 'rod install'] },
      { id: 'curtain-track', name: 'Curtain track installation', keywords: ['curtain track', 'curtain rail track', 'track install'] },
      { id: 'blind-install', name: 'Blind installation', keywords: ['blind install', 'install blinds', 'venetian blind', 'roman blind'] },
      { id: 'roller-blind', name: 'Roller blind installation', keywords: ['roller blind', 'roller blind install', 'roll up blind'] },
      { id: 'curtain-repair', name: 'Curtain repair', keywords: ['curtain repair', 'fix curtain', 'curtain hem', 'curtain seam'] },
      { id: 'curtain-cleaning', name: 'Curtain cleaning', keywords: ['curtain cleaning', 'wash curtains', 'steam clean curtains', 'curtain freshen'] },
      { id: 'sofa-repair', name: 'Sofa upholstery repair', keywords: ['sofa repair', 'sofa reupholstery', 'sofa covering', 'couch repair'] },
      { id: 'chair-upholstery', name: 'Chair upholstery', keywords: ['chair upholstery', 'reupholster chair', 'chair covering', 'dining chair'] },
      { id: 'cushion-repair', name: 'Cushion repair and replacement', keywords: ['cushion repair', 'cushion replacement', 'cushion cover', 'foam replacement'] },
    ],
  },
]

export interface SearchResult {
  type: 'category' | 'subService'
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  subServiceId?: string
  subServiceName?: string
  score: number
  correctedQuery?: string
}

export function aiSearch(query: string): SearchResult[] {
  const nq = normalize(query)
  if (!nq || nq.length < 1) return []

  const results: SearchResult[] = []

  for (const cat of CATEGORIES) {
    let catBestScore = 0
    let catCorrected: string | undefined

    for (const kw of cat.keywords) {
      const nkw = normalize(kw)

      if (nq === nkw) { catBestScore = Math.max(catBestScore, 100); continue }
      if (nkw.length >= 4 && nq.length <= nkw.length * 4 && (nq.includes(nkw) || nkw.includes(nq))) { catBestScore = Math.max(catBestScore, 95); continue }

      const dist = lev(nq, nkw)
      const maxLen = Math.max(nq.length, nkw.length)
      if (maxLen > 0) {
        const sim = 1 - dist / maxLen
        if (sim > 0.7 && Math.abs(nq.length - nkw.length) <= 4) {
          const score = Math.round(sim * 90)
          if (score > catBestScore) { catBestScore = score; catCorrected = kw }
        }
      }
    }

    for (const word of nq.split(/\s+/)) {
      if (word.length < 2) continue
      for (const kw of cat.keywords) {
        const nkw = normalize(kw)
        if (nkw.includes(word)) { catBestScore = Math.max(catBestScore, 85); break }
        for (const kPart of nkw.split(/\s+/)) {
          if (kPart.length < 3 && word.length < 3) continue
          const sim = similarity(word, kPart)
          if (sim > 0.75) { catBestScore = Math.max(catBestScore, Math.round(sim * 80)); break }
        }
      }
    }

    if (catBestScore >= 40) {
      results.push({
        type: 'category',
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.colorHex,
        score: catBestScore,
        correctedQuery: catBestScore < 85 ? catCorrected : undefined,
      })
    }

    for (const sub of cat.subServices) {
      let subScore = 0
      let subCorrected: string | undefined

      for (const kw of sub.keywords) {
        const nkw = normalize(kw)
        if (nq === nkw) { subScore = Math.max(subScore, 100); continue }
        if (nkw.length >= 4 && nq.length <= nkw.length * 4 && (nq.includes(nkw) || nkw.includes(nq))) { subScore = Math.max(subScore, 95); continue }

        const dist = lev(nq, nkw)
        const maxLen = Math.max(nq.length, nkw.length)
        if (maxLen > 0) {
          const sim = 1 - dist / maxLen
          if (sim > 0.7 && Math.abs(nq.length - nkw.length) <= 3) {
            const score = Math.round(sim * 85)
            if (score > subScore) { subScore = score; subCorrected = kw }
          }
        }
      }

      for (const word of nq.split(/\s+/)) {
        if (word.length < 2) continue
        for (const kw of sub.keywords) {
          const nkw = normalize(kw)
          if (nkw.includes(word)) { subScore = Math.max(subScore, 80); break }
          for (const kPart of nkw.split(/\s+/)) {
            if (kPart.length < 3 && word.length < 3) continue
            const sim = similarity(word, kPart)
            if (sim > 0.75) { subScore = Math.max(subScore, Math.round(sim * 75)); break }
          }
        }
      }

      if (subScore >= 50) {
        results.push({
          type: 'subService',
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          categoryColor: cat.colorHex,
          subServiceId: sub.id,
          subServiceName: sub.name,
          score: subScore,
          correctedQuery: subScore < 85 ? subCorrected : undefined,
        })
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 12)
}

export function getAutocompleteSuggestions(query: string): string[] {
  const nq = normalize(query)
  if (!nq || nq.length < 2) return []

  const suggestions = new Set<string>()

  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      const nkw = normalize(kw)
      if (nkw.startsWith(nq) || nq.startsWith(nkw)) {
        suggestions.add(kw)
      }
    }
    for (const sub of cat.subServices) {
      const name = sub.name.toLowerCase()
      if (name.includes(nq) || nq.includes(name.split(' ')[0])) {
        suggestions.add(sub.name)
      }
    }
  }

  return Array.from(suggestions).slice(0, 6)
}
